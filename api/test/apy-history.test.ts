import { sVusdAddress } from "@vetro-protocol/earn";
import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aprWadToApy } from "../src/apr-wad-to-apy.ts";
import { getApyHistory } from "../src/apy-history.ts";
import * as graphql from "../src/graphql.ts";
import { readWarmedTask } from "../src/warm-cache.ts";

vi.mock("../src/graphql.ts", () => ({
  runQuery: vi.fn(),
}));

// The live APY point is read from the warmed `variable-stake:apy` cache via
// readWarmedTask, so mock it to control the live value per test; the underlying
// on-chain computation is covered by variable-stake's tests. The task-factory
// helpers are re-exported as identities so warm-tasks.ts still loads.
vi.mock("../src/warm-cache.ts", () => ({
  globalWarmTask: (task: unknown) => task,
  keyedWarmTask: (task: unknown) => task,
  readWarmedTask: vi.fn(),
}));

const url = "https://subgraph.example/v1";

// readWarmedTask ignores the context here (it's mocked), so a stub suffices.
const c = {} as Context<{ Bindings: Env }>;

// Fixed "now" so the appended live point's timestamp is deterministic.
const now = 1_708_000_000_000;

// The APY the warmed cache reports for the vault under test.
const liveApy = 9.95;

const fetchHistory = (period = "1w") =>
  getApyHistory({ c, period, stakingVaultAddress: sVusdAddress, url });

const lastCallVariables = <T>() =>
  vi.mocked(graphql.runQuery).mock.calls.at(-1)?.[0].variables as T | undefined;

describe("apy-history/getApyHistory", function () {
  beforeEach(function () {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    // Default: the vault is present in the warmed cache with an active APY.
    vi.mocked(readWarmedTask).mockResolvedValue({
      [sVusdAddress]: { apy: liveApy },
    });
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  it("converts apr to apy and timestamp to ms, with a live point appended", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultAprHistories: [
        { apr: "100000000000000000", timestamp: "1707782400" }, // 0.1 -> ~10.52%
        { apr: "50000000000000000", timestamp: "1707868800" }, // 0.05 -> ~5.13%
      ],
    });

    const result = await fetchHistory();

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      apy: aprWadToApy(100000000000000000n),
      timestamp: 1_707_782_400_000,
    });
    expect(result[1]).toEqual({
      apy: aprWadToApy(50000000000000000n),
      timestamp: 1_707_868_800_000,
    });
    // Final point is the warmed live APY at the current time.
    expect(result[2]).toEqual({ apy: liveApy, timestamp: now });
  });

  it("skips the live point when the subgraph already has the current day with the same APY", async function () {
    // A subgraph point on today's UTC day whose APY equals the live value.
    const sameDayApr = "50000000000000000";
    const sameDayApy = aprWadToApy(BigInt(sameDayApr));
    vi.mocked(readWarmedTask).mockResolvedValue({
      [sVusdAddress]: { apy: sameDayApy },
    });
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultAprHistories: [
        { apr: "100000000000000000", timestamp: "1707782400" },
        // 2024-02-15: same UTC day as `now`.
        { apr: sameDayApr, timestamp: "1707955200" },
      ],
    });

    const result = await fetchHistory();

    expect(result).toHaveLength(2);
    // The day-aligned subgraph point is kept; the live point is not appended.
    expect(result.at(-1)).toEqual({
      apy: sameDayApy,
      timestamp: 1_707_955_200_000,
    });
    expect(result.some((point) => point.timestamp === now)).toBe(false);
  });

  it("replaces the current day's subgraph point with the live point when the APY differs", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultAprHistories: [
        // 2024-02-13: an earlier day, retained as-is.
        { apr: "100000000000000000", timestamp: "1707782400" },
        // 2024-02-15: same UTC day as `now`, with an APY unlike the live value.
        { apr: "50000000000000000", timestamp: "1707955200" },
      ],
    });

    const result = await fetchHistory();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      apy: aprWadToApy(100000000000000000n),
      timestamp: 1_707_782_400_000,
    });
    // The stale same-day subgraph point is dropped in favor of the live value.
    expect(result.some((point) => point.timestamp === 1_707_955_200_000)).toBe(
      false,
    );
    expect(result.at(-1)).toEqual({ apy: liveApy, timestamp: now });
  });

  it("returns only the live point when the subgraph returns no entries", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ vaultAprHistories: [] });

    expect(await fetchHistory()).toEqual([{ apy: liveApy, timestamp: now }]);
  });

  it("appends a live point of 0 as a genuine reading", async function () {
    vi.mocked(readWarmedTask).mockResolvedValue({
      [sVusdAddress]: { apy: 0 },
    });
    vi.mocked(graphql.runQuery).mockResolvedValue({ vaultAprHistories: [] });

    expect(await fetchHistory()).toEqual([{ apy: 0, timestamp: now }]);
  });

  it("returns only the subgraph series when the vault is absent from the warmed cache", async function () {
    // The vault's warm-time reads failed, so it is omitted from the cached record.
    vi.mocked(readWarmedTask).mockResolvedValue({});
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultAprHistories: [
        { apr: "100000000000000000", timestamp: "1707782400" },
      ],
    });

    expect(await fetchHistory()).toEqual([
      { apy: aprWadToApy(100000000000000000n), timestamp: 1_707_782_400_000 },
    ]);
  });

  it("returns only the subgraph series when the warmed read fails", async function () {
    // A KV read error must degrade to subgraph-only, not fail the whole request.
    vi.mocked(readWarmedTask).mockRejectedValue(new Error("kv down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultAprHistories: [
        { apr: "100000000000000000", timestamp: "1707782400" },
      ],
    });

    expect(await fetchHistory()).toEqual([
      { apy: aprWadToApy(100000000000000000n), timestamp: 1_707_782_400_000 },
    ]);
    warn.mockRestore();
  });

  it("queries the subgraph with the staking vault address lowercased", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ vaultAprHistories: [] });

    await fetchHistory();

    expect(lastCallVariables<{ stakingVault: string }>()?.stakingVault).toBe(
      sVusdAddress.toLowerCase(),
    );
  });
});
