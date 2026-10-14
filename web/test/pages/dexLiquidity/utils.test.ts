import type { DexPool } from "@vetro-protocol/core";
import { isPoolVisible, sortByTvl } from "pages/dexLiquidity/utils";
import { describe, expect, it } from "vitest";

const reward: DexPool["rewards"][number] = {
  apr: 0.1,
  source: "merkl",
  sourceMetadata: { campaignId: "0x01", opportunityId: "1" },
  tokens: [],
};

const buildPool = (overrides: Partial<DexPool> = {}) =>
  ({
    address: "0x0000000000000000000000000000000000000001",
    apr: null,
    chainId: 1,
    coins: [],
    dex: "uniswap",
    rewards: [],
    tvlUsd: 1000,
    volumeUsd24h: 0,
    ...overrides,
  }) as DexPool;

describe("isPoolVisible", function () {
  it("hides a pool without rewards and TVL below 500 USD", function () {
    expect(isPoolVisible(buildPool({ tvlUsd: 499.99 }))).toBe(false);
  });

  it("shows a pool with rewards and TVL below 500 USD", function () {
    expect(isPoolVisible(buildPool({ rewards: [reward], tvlUsd: 10 }))).toBe(
      true,
    );
  });

  it("shows a pool without rewards and TVL of 500 USD", function () {
    expect(isPoolVisible(buildPool({ tvlUsd: 500 }))).toBe(true);
  });

  it("hides a pool without rewards and an unknown TVL", function () {
    expect(isPoolVisible(buildPool({ tvlUsd: null }))).toBe(false);
  });

  it("shows a pool with rewards and an unknown TVL", function () {
    expect(isPoolVisible(buildPool({ rewards: [reward], tvlUsd: null }))).toBe(
      true,
    );
  });
});

describe("sortByTvl", function () {
  it("sorts pools by TVL in descending order", function () {
    const pools = [10, 1000, 500].map((tvlUsd) => buildPool({ tvlUsd }));

    expect(sortByTvl(pools).map((pool) => pool.tvlUsd)).toEqual([
      1000, 500, 10,
    ]);
  });

  it("puts pools with an unknown TVL last", function () {
    const pools = [null, 0, 100].map((tvlUsd) => buildPool({ tvlUsd }));

    expect(sortByTvl(pools).map((pool) => pool.tvlUsd)).toEqual([100, 0, null]);
  });
});
