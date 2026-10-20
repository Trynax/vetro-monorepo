import { sVusdAddress } from "@vetro-protocol/earn";
import { type Address } from "viem";
import { decimals } from "viem-erc20/actions";
import { asset, convertToAssets } from "viem-erc4626/actions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as graphql from "../src/graphql.ts";
import { getShareValueHistory } from "../src/share-value-history.ts";

// Hoisted so the vi.mock factory below (which vitest hoists above the module
// body) can reference it as asset()'s fixed return value.
const { assetAddress } = vi.hoisted(() => ({
  assetAddress: "0x000000000000000000000000000000000000dEaD" as Address,
}));

vi.mock("../src/graphql.ts", () => ({
  runQuery: vi.fn(),
}));

vi.mock("viem-erc20/actions", () => ({
  decimals: vi.fn(),
}));

vi.mock("viem-erc4626/actions", () => ({
  // asset() never varies across tests, so its return lives in the definition.
  asset: vi.fn().mockResolvedValue(assetAddress),
  convertToAssets: vi.fn(),
}));

const url = "https://subgraph.example/v1";
const rpcUrl = "https://rpc.example";

// Fixed "now" so the appended live point's timestamp is deterministic.
const now = 1_708_000_000_000;
const liveShareValue = 1_000_600_000_000_000_000n;
const livePoint = { shareValue: 1.0006, timestamp: now };

const fetchHistory = (period = "1w") =>
  getShareValueHistory({
    period,
    rpcUrl,
    stakingVaultAddress: sVusdAddress,
    url,
  });

const lastCallVariables = <T>() =>
  vi.mocked(graphql.runQuery).mock.calls.at(-1)?.[0].variables as T | undefined;

describe("share-value-history/getShareValueHistory", function () {
  beforeEach(function () {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.mocked(asset).mockResolvedValue(assetAddress);
    vi.mocked(decimals).mockResolvedValue(18);
    vi.mocked(convertToAssets).mockResolvedValue(liveShareValue);
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  it("returns only the live point when the subgraph returns no entries", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ vaultHistories: [] });

    expect(await fetchHistory()).toEqual([livePoint]);
  });

  it("scales shareValue to a number and converts timestamp to ms, with a live point appended", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultHistories: [
        { shareValue: "1000412938421000000", timestamp: "1707782400" },
        { shareValue: "1000506129482000000", timestamp: "1707868800" },
      ],
    });

    expect(await fetchHistory()).toEqual([
      { shareValue: 1.000412938421, timestamp: 1_707_782_400_000 },
      { shareValue: 1.000506129482, timestamp: 1_707_868_800_000 },
      livePoint,
    ]);
  });

  it("replaces the current UTC day's subgraph point with the live point", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultHistories: [
        { shareValue: "1000412938421000000", timestamp: "1707782400" },
        // same UTC day as `now`, with a value unlike the live read
        { shareValue: "1000500000000000000", timestamp: "1707955200" },
      ],
    });

    // The stale same-day point is dropped, so the series never has two points on
    // the same UTC day.
    expect(await fetchHistory()).toEqual([
      { shareValue: 1.000412938421, timestamp: 1_707_782_400_000 },
      livePoint,
    ]);
  });

  it("scales by the asset decimals while using the share decimals for one share", async function () {
    const assetDecimals = 6;
    const shareDecimals = 18;
    vi.mocked(decimals).mockImplementation((_client, { address }) =>
      Promise.resolve(address === assetAddress ? assetDecimals : shareDecimals),
    );
    // 1.6 in the asset's 6-decimal base units
    vi.mocked(convertToAssets).mockResolvedValue(1_600_000n);
    vi.mocked(graphql.runQuery).mockResolvedValue({
      // 1.5 in the asset's 6-decimal base units
      vaultHistories: [{ shareValue: "1500000", timestamp: "1707782400" }],
    });

    expect(await fetchHistory()).toEqual([
      { shareValue: 1.5, timestamp: 1_707_782_400_000 },
      { shareValue: 1.6, timestamp: now },
    ]);
    // one whole share uses the share token's decimals, not the asset's
    expect(vi.mocked(convertToAssets)).toHaveBeenCalledWith(expect.anything(), {
      address: sVusdAddress,
      shares: 10n ** 18n,
    });
  });

  it("falls back to the subgraph series when the live share value read fails", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultHistories: [
        { shareValue: "1000412938421000000", timestamp: "1707782400" },
      ],
    });
    vi.mocked(convertToAssets).mockRejectedValue(new Error("rpc down"));

    expect(await fetchHistory()).toEqual([
      { shareValue: 1.000412938421, timestamp: 1_707_782_400_000 },
    ]);
  });

  it("rejects when the on-chain asset decimals read fails", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      vaultHistories: [
        { shareValue: "1000412938421000000", timestamp: "1707782400" },
      ],
    });
    vi.mocked(decimals).mockRejectedValue(new Error("rpc down"));

    await expect(fetchHistory()).rejects.toThrow("rpc down");
  });

  it("queries the subgraph with the staking vault address lowercased", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ vaultHistories: [] });

    await fetchHistory();

    expect(lastCallVariables<{ stakingVault: string }>()?.stakingVault).toBe(
      sVusdAddress.toLowerCase(),
    );
  });
});
