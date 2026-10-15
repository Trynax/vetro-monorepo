import type { DexPool } from "@vetro-protocol/core";
import { isAddressEqual } from "viem";

const minTvlUsd = 500;

const isPoolVisible = (pool: DexPool) =>
  pool.rewards.length > 0 || (pool.tvlUsd ?? 0) >= minTvlUsd;

export const excludeLowTvlPools = function (pools: DexPool[]) {
  const visiblePools = pools.filter(
    (pool) => !pool.range && isPoolVisible(pool),
  );
  return pools.filter((pool) =>
    visiblePools.some(
      (visiblePool) =>
        visiblePool.chainId === pool.chainId &&
        isAddressEqual(visiblePool.address, pool.address),
    ),
  );
};
