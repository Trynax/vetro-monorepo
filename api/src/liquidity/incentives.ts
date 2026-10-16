import type {
  DexPool,
  DexPoolReward,
  DexRewardToken,
} from "@vetro-protocol/core";
import { type Address, checksumAddress, type Hash, isAddressEqual } from "viem";
import { hemi, mainnet } from "viem/chains";

import { getLiveOpportunities } from "../merkl.ts";

import { crvAddress } from "./curve.ts";
import {
  getStrategies,
  type StakeDaoStrategy,
  strategyRewardsApr,
} from "./stake-dao.ts";

type MerklReward = {
  apr: number;
  campaignId: Hash;
  chainId: number;
  identifier: Address;
  opportunityId: string;
  token: DexRewardToken;
};

type GaugedStrategy = StakeDaoStrategy & { gaugeAddress: Address };

export type IncentiveSources = {
  campaignGauges: { chainId: number; gauge: Address }[];
  merklRewards: MerklReward[];
  strategies: GaugedStrategy[];
};

const curveGaugeAddress = (pool: DexPool) =>
  pool.dex === "curve" ? pool.dexMetadata.gaugeAddress : undefined;

const poolAddresses = (pool: DexPool) =>
  [
    pool.address,
    curveGaugeAddress(pool),
    pool.dex === "curve" ? pool.dexMetadata.lpTokenAddress : undefined,
  ].filter((address) => address !== undefined);

export const getMerklRewards = async function ({
  nowSeconds,
  pools,
}: {
  nowSeconds: number;
  pools: DexPool[];
}) {
  const identifiers = [...new Set(pools.flatMap(poolAddresses))];
  const opportunities = await getLiveOpportunities({
    chainIds: [mainnet.id, hemi.id],
    identifiers,
  });
  return opportunities.flatMap((opportunity) =>
    opportunity.campaigns
      .filter(
        (campaign) =>
          Number(campaign.startTimestamp) <= nowSeconds &&
          Number(campaign.endTimestamp) > nowSeconds,
      )
      .map(
        (campaign): MerklReward => ({
          apr: campaign.apr,
          campaignId: campaign.campaignId,
          chainId: opportunity.chainId,
          identifier: checksumAddress(opportunity.identifier),
          opportunityId: opportunity.id,
          token: {
            address: checksumAddress(campaign.rewardToken.address),
            chainId: campaign.rewardToken.chainId,
          },
        }),
      ),
  );
};

// Curve pools are only on Ethereum today.
export const getGaugedStrategies = () =>
  getStrategies(mainnet.id).then((strategies) =>
    strategies.filter(
      (strategy): strategy is GaugedStrategy => strategy.gaugeAddress !== null,
    ),
  );

const stakeDaoReward = function ({
  chainId,
  gauge,
  nowSeconds,
  sources,
}: {
  chainId: number;
  gauge: Address;
  nowSeconds: number;
  sources: IncentiveSources;
}): DexPoolReward[] {
  const hasCampaign = sources.campaignGauges.some(
    (campaign) =>
      campaign.chainId === chainId && isAddressEqual(campaign.gauge, gauge),
  );
  const strategy = sources.strategies.find(
    (candidate) =>
      candidate.chainId === chainId &&
      isAddressEqual(candidate.gaugeAddress, gauge),
  );
  if (!hasCampaign || !strategy) {
    return [];
  }
  const apr = strategyRewardsApr(strategy);
  if (apr <= 0) {
    return [];
  }
  // The CRV entry always has an APR of 0, but the strategy pays CRV.
  const tokenAddresses = strategy.rewards
    .filter(
      (reward) =>
        isAddressEqual(reward.token.address, crvAddress) ||
        (reward.apr > 0 && reward.end > nowSeconds),
    )
    .map((reward) => checksumAddress(reward.token.address));
  return [
    {
      apr,
      source: "stakeDao",
      sourceMetadata: { strategyKey: strategy.key },
      tokens: [...new Set(tokenAddresses)].map((address) => ({
        address,
        chainId,
      })),
    },
  ];
};

const merklRewards = function ({
  pool,
  sources,
}: {
  pool: DexPool;
  sources: IncentiveSources;
}): DexPoolReward[] {
  const addresses = poolAddresses(pool);
  return sources.merklRewards
    .filter(
      (reward) =>
        reward.chainId === pool.chainId &&
        addresses.some((address) => isAddressEqual(address, reward.identifier)),
    )
    .sort((a, b) => b.apr - a.apr)
    .map((reward) => ({
      apr: reward.apr,
      source: "merkl",
      sourceMetadata: {
        campaignId: reward.campaignId,
        opportunityId: reward.opportunityId,
      },
      tokens: [reward.token],
    }));
};

/**
 * Adds the StakeDAO strategy and then the Merkl campaigns by APR, after the
 * rewards that the venue gives (the Curve gauge).
 */
export function addIncentives({
  nowSeconds,
  pool,
  sources,
}: {
  nowSeconds: number;
  pool: DexPool;
  sources: IncentiveSources;
}): DexPool {
  const gaugeAddress = curveGaugeAddress(pool);
  return {
    ...pool,
    rewards: [
      ...pool.rewards,
      ...(gaugeAddress
        ? stakeDaoReward({
            chainId: pool.chainId,
            gauge: gaugeAddress,
            nowSeconds,
            sources,
          })
        : []),
      ...merklRewards({ pool, sources }),
    ],
  };
}
