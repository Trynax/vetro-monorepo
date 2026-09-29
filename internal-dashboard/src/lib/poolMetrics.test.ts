import { type Address, parseUnits } from "viem";
import { describe, expect, it } from "vitest";

import { poolTvlUsd, summarizeDexTvl } from "./poolMetrics";
import { type PoolCoin, type TrackedPool } from "./types";

const coin = ({
  balance,
  decimals,
  usdPrice,
}: {
  balance: string;
  decimals: number;
  usdPrice: number | undefined;
}): PoolCoin => ({
  address: `0x${"1".repeat(40)}` as Address,
  balance: parseUnits(balance, decimals),
  decimals,
  symbol: "TKN",
  usdPrice,
});

const pool = ({
  coins = [],
  id,
  isRangeView,
  tvlUsd,
}: {
  coins?: PoolCoin[];
  id: string;
  isRangeView?: boolean;
  tvlUsd: number | undefined;
}): TrackedPool => ({
  address: `0x${"2".repeat(40)}` as Address,
  baseApy: undefined,
  chainId: 1,
  coins,
  dex: "sushi",
  gaugeAddress: undefined,
  id,
  isRangeView,
  lpTokenAddress: undefined,
  name: "VUSD/USDT",
  poolType: "v3",
  rewardApy: 0,
  rewardApyMax: 0,
  tvlUsd,
  url: "https://example.com",
  virtualPrice: 1,
  volumeUsd24h: 0,
});

describe("poolTvlUsd", function () {
  it("values every leg and sums them", function () {
    expect(
      poolTvlUsd([
        coin({ balance: "100", decimals: 18, usdPrice: 2 }),
        coin({ balance: "50", decimals: 18, usdPrice: 3 }),
      ]),
    ).toBe(350);
  });

  it("scales each leg by its own decimals", function () {
    expect(
      poolTvlUsd([
        coin({ balance: "1000", decimals: 6, usdPrice: 1 }),
        coin({ balance: "1000", decimals: 18, usdPrice: 1 }),
      ]),
    ).toBe(2000);
  });

  it("prices a fractional balance", function () {
    expect(
      poolTvlUsd([coin({ balance: "0.5", decimals: 8, usdPrice: 60_000 })]),
    ).toBe(30_000);
  });

  it("counts a leg worth zero as nothing", function () {
    expect(
      poolTvlUsd([
        coin({ balance: "100", decimals: 18, usdPrice: 1 }),
        coin({ balance: "999", decimals: 18, usdPrice: 0 }),
      ]),
    ).toBe(100);
  });

  it("is undefined when a leg has no price", function () {
    expect(
      poolTvlUsd([
        coin({ balance: "100", decimals: 18, usdPrice: 1 }),
        coin({ balance: "999", decimals: 18, usdPrice: undefined }),
      ]),
    ).toBeUndefined();
  });

  it("sums more than two legs", function () {
    expect(
      poolTvlUsd([
        coin({ balance: "1", decimals: 18, usdPrice: 1 }),
        coin({ balance: "2", decimals: 6, usdPrice: 1 }),
        coin({ balance: "3", decimals: 8, usdPrice: 1 }),
      ]),
    ).toBe(6);
  });

  it("is zero for an empty pool", function () {
    expect(poolTvlUsd([])).toBe(0);
  });

  it("is zero when every leg is empty", function () {
    expect(
      poolTvlUsd([
        coin({ balance: "0", decimals: 18, usdPrice: 1 }),
        coin({ balance: "0", decimals: 6, usdPrice: 1 }),
      ]),
    ).toBe(0);
  });

  it("keeps a balance past Number's exact integer range accurate", function () {
    expect(
      poolTvlUsd([coin({ balance: "10000000", decimals: 18, usdPrice: 1.5 })]),
    ).toBeCloseTo(15_000_000, 2);
  });
});

describe("summarizeDexTvl", function () {
  it("sums the TVL of every pool", function () {
    expect(
      summarizeDexTvl([
        pool({ id: "a", tvlUsd: 100 }),
        pool({ id: "b", tvlUsd: 250.5 }),
        pool({ id: "c", tvlUsd: 1000 }),
      ]),
    ).toEqual({ poolCount: 3, totalTvlUsd: 1350.5, unpricedPoolCount: 0 });
  });

  it("excludes range views from the total and the pool count", function () {
    expect(
      summarizeDexTvl([
        pool({ id: "full", tvlUsd: 1000 }),
        pool({ id: "full-0.96-1.04", isRangeView: true, tvlUsd: 400 }),
        pool({ id: "other", tvlUsd: 500 }),
      ]),
    ).toEqual({ poolCount: 2, totalTvlUsd: 1500, unpricedPoolCount: 0 });
  });

  it("counts a pool with an explicit false isRangeView", function () {
    expect(
      summarizeDexTvl([
        pool({ id: "a", isRangeView: false, tvlUsd: 300 }),
        pool({ id: "b", tvlUsd: 700 }),
      ]),
    ).toEqual({ poolCount: 2, totalTvlUsd: 1000, unpricedPoolCount: 0 });
  });

  it("counts an unpriced pool without adding it to the total", function () {
    expect(
      summarizeDexTvl([
        pool({ id: "a", tvlUsd: 200 }),
        pool({ id: "b", tvlUsd: undefined }),
      ]),
    ).toEqual({ poolCount: 2, totalTvlUsd: 200, unpricedPoolCount: 1 });
  });

  it("keeps a pool worth zero as priced", function () {
    expect(
      summarizeDexTvl([
        pool({ id: "a", tvlUsd: 0 }),
        pool({ id: "b", tvlUsd: 50 }),
      ]),
    ).toEqual({ poolCount: 2, totalTvlUsd: 50, unpricedPoolCount: 0 });
  });

  it("totals zero when every pool is unpriced", function () {
    expect(
      summarizeDexTvl([
        pool({ id: "a", tvlUsd: undefined }),
        pool({ id: "b", tvlUsd: undefined }),
      ]),
    ).toEqual({ poolCount: 2, totalTvlUsd: 0, unpricedPoolCount: 2 });
  });

  it("ignores an unpriced range view entirely", function () {
    expect(
      summarizeDexTvl([
        pool({ id: "full", tvlUsd: 800 }),
        pool({ id: "full-0.96-1.04", isRangeView: true, tvlUsd: undefined }),
      ]),
    ).toEqual({ poolCount: 1, totalTvlUsd: 800, unpricedPoolCount: 0 });
  });

  it("sums a pool with an unpriced leg and flags it as unpriced", function () {
    // Mirrors Curve's vetBTC/WBTC: usdTotal only counts the priced WBTC leg.
    expect(
      summarizeDexTvl([
        pool({
          coins: [
            coin({ balance: "0.0269", decimals: 18, usdPrice: undefined }),
            coin({ balance: "0.01835411", decimals: 8, usdPrice: 83_304 }),
          ],
          id: "partial",
          tvlUsd: 1528.97,
        }),
        pool({
          coins: [
            coin({ balance: "100", decimals: 18, usdPrice: 1 }),
            coin({ balance: "100", decimals: 6, usdPrice: 1 }),
          ],
          id: "priced",
          tvlUsd: 200,
        }),
      ]),
    ).toEqual({ poolCount: 2, totalTvlUsd: 1728.97, unpricedPoolCount: 1 });
  });

  it("does not flag a pool whose only unpriced leg is empty", function () {
    // Mirrors Curve's VUSD/USDC: VUSD has no price but a zero balance.
    expect(
      summarizeDexTvl([
        pool({
          coins: [
            coin({ balance: "0", decimals: 18, usdPrice: undefined }),
            coin({ balance: "500", decimals: 6, usdPrice: 1 }),
          ],
          id: "empty-leg",
          tvlUsd: 500,
        }),
      ]),
    ).toEqual({ poolCount: 1, totalTvlUsd: 500, unpricedPoolCount: 0 });
  });

  it("flags a pool when any one of several legs is unpriced", function () {
    expect(
      summarizeDexTvl([
        pool({
          coins: [
            coin({ balance: "10", decimals: 18, usdPrice: 1 }),
            coin({ balance: "0", decimals: 6, usdPrice: undefined }),
            coin({ balance: "1", decimals: 8, usdPrice: undefined }),
          ],
          id: "three-legs",
          tvlUsd: 10,
        }),
      ]),
    ).toEqual({ poolCount: 1, totalTvlUsd: 10, unpricedPoolCount: 1 });
  });

  it("counts a pool with no TVL and an unpriced leg once", function () {
    expect(
      summarizeDexTvl([
        pool({
          coins: [coin({ balance: "5", decimals: 18, usdPrice: undefined })],
          id: "a",
          tvlUsd: undefined,
        }),
        pool({ id: "b", tvlUsd: 40 }),
      ]),
    ).toEqual({ poolCount: 2, totalTvlUsd: 40, unpricedPoolCount: 1 });
  });

  it("ignores a range view with an unpriced leg", function () {
    expect(
      summarizeDexTvl([
        pool({ id: "full", tvlUsd: 800 }),
        pool({
          coins: [
            coin({ balance: "3", decimals: 18, usdPrice: undefined }),
            coin({ balance: "3", decimals: 6, usdPrice: 1 }),
          ],
          id: "full-0.96-1.04",
          isRangeView: true,
          tvlUsd: 3,
        }),
      ]),
    ).toEqual({ poolCount: 1, totalTvlUsd: 800, unpricedPoolCount: 0 });
  });

  it("is all zeros for an empty list", function () {
    expect(summarizeDexTvl([])).toEqual({
      poolCount: 0,
      totalTvlUsd: 0,
      unpricedPoolCount: 0,
    });
  });

  it("is all zeros when every entry is a range view", function () {
    expect(
      summarizeDexTvl([
        pool({ id: "band-1", isRangeView: true, tvlUsd: 400 }),
        pool({ id: "band-2", isRangeView: true, tvlUsd: undefined }),
      ]),
    ).toEqual({ poolCount: 0, totalTvlUsd: 0, unpricedPoolCount: 0 });
  });
});
