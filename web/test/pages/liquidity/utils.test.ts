import type { DexPool } from "@vetro-protocol/core";
import { getPoolsTotals, sortByTvl } from "pages/liquidity/utils";
import { describe, expect, it } from "vitest";

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

describe("getPoolsTotals", function () {
  it("sums the TVL and the 24h volume of the pools", function () {
    const pools = [
      buildPool({ tvlUsd: 1000, volumeUsd24h: 250 }),
      buildPool({ tvlUsd: 2500.5, volumeUsd24h: 40.25 }),
    ];

    expect(getPoolsTotals(pools)).toEqual({
      tvlUsd: 3500.5,
      volumeUsd24h: 290.25,
    });
  });

  it("adds nothing to the TVL for a pool with an unknown TVL", function () {
    const pools = [
      buildPool({ tvlUsd: 1000, volumeUsd24h: 250 }),
      buildPool({ tvlUsd: null, volumeUsd24h: 75 }),
    ];

    expect(getPoolsTotals(pools)).toEqual({
      tvlUsd: 1000,
      volumeUsd24h: 325,
    });
  });

  it("returns zero totals for an empty list", function () {
    expect(getPoolsTotals([])).toEqual({ tvlUsd: 0, volumeUsd24h: 0 });
  });
});
