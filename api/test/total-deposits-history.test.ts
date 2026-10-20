import { sVusdAddress } from "@vetro-protocol/earn";
import { totalAssets } from "viem-erc4626/actions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as graphql from "../src/graphql.ts";
import { getTotalDepositsHistory } from "../src/total-deposits-history.ts";

vi.mock("../src/graphql.ts", () => ({
  runQuery: vi.fn(),
}));

vi.mock("viem-erc4626/actions", () => ({
  totalAssets: vi.fn(),
}));

const url = "https://subgraph.example/v1";
const rpcUrl = "https://rpc.example";

// Fixed "now" so the appended live point's timestamp is deterministic.
const now = 1_708_000_000_000;
const liveTotalAssets = 6_000_000_000_000_000_000_000n;
const livePoint = { timestamp: now, totalDeposits: liveTotalAssets.toString() };

const fetchHistory = (period = "1w") =>
  getTotalDepositsHistory({
    period,
    rpcUrl,
    stakingVaultAddress: sVusdAddress,
    url,
  });

const lastCallVariables = <T>() =>
  vi.mocked(graphql.runQuery).mock.calls.at(-1)?.[0].variables as T | undefined;

describe("total-deposits-history/getTotalDepositsHistory", function () {
  beforeEach(function () {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.mocked(totalAssets).mockResolvedValue(liveTotalAssets);
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  it("returns only the live point when the subgraph returns no entries", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ vaultHistories: [] });

    expect(await fetchHistory()).toEqual([livePoint]);
  });

  it("returns totalAssets as a raw base-units string and converts timestamp to ms, with a live point appended", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultHistories: [
        { timestamp: "1707782400", totalAssets: "5000000000000000000000" },
        { timestamp: "1707868800", totalAssets: "5100000000000000000000" },
      ],
    });

    expect(await fetchHistory()).toEqual([
      { timestamp: 1_707_782_400_000, totalDeposits: "5000000000000000000000" },
      { timestamp: 1_707_868_800_000, totalDeposits: "5100000000000000000000" },
      livePoint,
    ]);
  });

  it("replaces the current UTC day's subgraph point with the live point", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultHistories: [
        { timestamp: "1707782400", totalAssets: "5000000000000000000000" },
        // same UTC day as `now`, with a value unlike the live read
        { timestamp: "1707955200", totalAssets: "5900000000000000000000" },
      ],
    });

    // The stale same-day point is dropped, so the series never has two points on
    // the same UTC day.
    expect(await fetchHistory()).toEqual([
      { timestamp: 1_707_782_400_000, totalDeposits: "5000000000000000000000" },
      livePoint,
    ]);
  });

  it("falls back to the subgraph series when the live totalAssets read fails", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultHistories: [
        { timestamp: "1707782400", totalAssets: "5000000000000000000000" },
      ],
    });
    vi.mocked(totalAssets).mockRejectedValue(new Error("rpc down"));

    expect(await fetchHistory()).toEqual([
      { timestamp: 1_707_782_400_000, totalDeposits: "5000000000000000000000" },
    ]);
  });

  it("queries the subgraph with the staking vault address lowercased", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ vaultHistories: [] });

    await fetchHistory();

    expect(lastCallVariables<{ stakingVault: string }>()?.stakingVault).toBe(
      sVusdAddress.toLowerCase(),
    );
  });
});
