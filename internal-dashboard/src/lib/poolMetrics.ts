import { formatUnits } from "viem";

import { type PoolCoin, type TrackedPool } from "./types";

export const poolTvlUsd = function (coins: PoolCoin[]) {
  let total = 0;
  for (const coin of coins) {
    if (coin.usdPrice === undefined) {
      return undefined;
    }
    total += Number(formatUnits(coin.balance, coin.decimals)) * coin.usdPrice;
  }
  return total;
};

export const summarizeDexTvl = function (pools: TrackedPool[]) {
  let poolCount = 0;
  let totalTvlUsd = 0;
  let unpricedPoolCount = 0;
  for (const pool of pools) {
    if (pool.isRangeView) {
      continue;
    }
    poolCount += 1;
    // Venues like Curve publish a TVL that only counts their priced legs, so a
    // defined tvlUsd can still leave out liquidity. Empty legs change nothing.
    const hasUnpricedLeg = pool.coins.some(
      (coin) => coin.balance > 0n && coin.usdPrice === undefined,
    );
    if (pool.tvlUsd === undefined || hasUnpricedLeg) {
      unpricedPoolCount += 1;
    }
    if (pool.tvlUsd !== undefined) {
      totalTvlUsd += pool.tvlUsd;
    }
  }
  return { poolCount, totalTvlUsd, unpricedPoolCount };
};
