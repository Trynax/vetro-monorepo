import {
  type CampaignSource,
  campaignSourceLabels,
} from "../config/campaignSources";

import { formatDuration } from "./format";
import {
  type StakeDaoStrategy,
  stakeDaoRewardsAprPercent,
} from "./stakeDaoApi";
import { type MerklPoolCampaign, type PoolCampaign } from "./types";

const day = 24 * 60 * 60;
const endingSoonThresholdDays = 7;

export const endingSoonThresholdSeconds = endingSoonThresholdDays * day;

export const endingSoonTooltip = `Ends in less than ${endingSoonThresholdDays} days`;

export const endsSoon = (secondsLeft: number) =>
  secondsLeft < endingSoonThresholdSeconds;

export const campaignKey = ({
  address,
  chainId,
}: {
  address: string;
  chainId: number;
}) => `${chainId}-${address.toLowerCase()}`;

export const campaignLabel = ({
  campaign,
  nowSeconds,
}: {
  campaign: PoolCampaign;
  nowSeconds: number;
}) =>
  `${campaignSourceLabels[campaign.source]} · ${campaign.rewardTokenSymbol} · ${formatDuration(campaign.endTimestamp - nowSeconds)}`;

export type RewardAprRow = {
  aprPercent: number;
  id: string;
  source: CampaignSource;
  tokenSymbols: string;
};

// StakeDAO campaigns are Votemarket incentives paid to veCRV voters, not to
// LPs, so only Merkl campaigns and the StakeDAO LP strategy count as rewards.
export const rewardAprRows = function ({
  campaigns,
  stakeDaoStrategy,
}: {
  campaigns: PoolCampaign[];
  stakeDaoStrategy: StakeDaoStrategy | null;
}) {
  const rows: RewardAprRow[] = campaigns
    .filter(
      (campaign): campaign is MerklPoolCampaign => campaign.source === "merkl",
    )
    .map((campaign) => ({
      aprPercent: campaign.aprPercent,
      id: campaign.id,
      source: "merkl",
      tokenSymbols: campaign.rewardTokenSymbol,
    }));
  if (stakeDaoStrategy) {
    const aprPercent = stakeDaoRewardsAprPercent(stakeDaoStrategy);
    if (aprPercent > 0) {
      rows.push({
        aprPercent,
        id: stakeDaoStrategy.key,
        source: "stakeDao",
        tokenSymbols: [
          ...new Set(
            stakeDaoStrategy.rewards.map((reward) => reward.token.symbol),
          ),
        ].join("/"),
      });
    }
  }
  return rows.sort((a, b) => b.aprPercent - a.aprPercent);
};
