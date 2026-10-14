import type { DexPool, DexPoolReward } from "@vetro-protocol/core";

const minTvlUsd = 500;

export const dexNames: Record<DexPool["dex"], string> = {
  brownfi: "BrownFi",
  curve: "Curve",
  sushi: "Sushi",
  uniswap: "Uniswap",
};

export const getDepositUrl = function (pool: DexPool) {
  if (pool.dex === "curve") {
    return `https://www.curve.finance/dex/ethereum/pools/${pool.dexMetadata.poolId}/deposit`;
  }
  const urls = {
    brownfi: `https://app.brownfi.io/clamm/analytics/pools/${pool.address.toLowerCase()}`,
    sushi: `https://www.sushi.com/ethereum/pool/v3/${pool.address}`,
    uniswap: `https://app.uniswap.org/explore/pools/ethereum/${pool.address}`,
  };
  return urls[pool.dex];
};

export const getRewardUrl = function ({
  pool,
  reward,
}: {
  pool: DexPool;
  reward: DexPoolReward;
}) {
  if (reward.source === "merkl") {
    return `https://app.merkl.xyz/opportunities/${reward.sourceMetadata.opportunityId}/campaigns/${reward.sourceMetadata.campaignId}`;
  }
  if (reward.source === "stakeDao") {
    return `https://app.stakedao.org/strategy?protocol=curve&vault=${encodeURIComponent(reward.sourceMetadata.strategyKey)}`;
  }
  return getDepositUrl(pool);
};

export const sortByTvl = (pools: DexPool[]) =>
  [...pools].sort((a, b) => (b.tvlUsd ?? -1) - (a.tvlUsd ?? -1));

export const isPoolVisible = (pool: DexPool) =>
  pool.rewards.length > 0 || (pool.tvlUsd ?? 0) >= minTvlUsd;
