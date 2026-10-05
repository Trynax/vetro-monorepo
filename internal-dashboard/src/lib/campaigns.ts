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

type RewardSource = CampaignSource | "curveGauge";

export type RewardAprRow = {
  aprPercent: number;
  aprPercentMax?: number;
  id: string;
  source: RewardSource;
  tokenSymbols: string;
};

// Rows in a fixed order: the venue's gauge emissions (what an LP gets by
// staking in the Curve gauge directly), then the StakeDAO LP strategy, which
// is an alternative to that gauge line, not an addition, so it sits right
// under it. Merkl campaigns follow, highest APR first. StakeDAO campaigns are
// Votemarket incentives paid to veCRV voters, not to LPs, so they stay out.
export const rewardAprRows = function ({
  campaigns,
  emission,
  stakeDaoStrategy,
}: {
  campaigns: PoolCampaign[];
  emission: { emissionApy: number; emissionApyMax: number; id: string };
  stakeDaoStrategy: StakeDaoStrategy | null;
}) {
  const rows: RewardAprRow[] = [];
  if (emission.emissionApy > 0) {
    rows.push({
      aprPercent: emission.emissionApy,
      aprPercentMax: emission.emissionApyMax,
      id: `curve-gauge-${emission.id}`,
      source: "curveGauge",
      // Only Curve gauges set emissions today.
      tokenSymbols: "CRV",
    });
  }
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
  const merklRows = campaigns
    .filter(
      (campaign): campaign is MerklPoolCampaign => campaign.source === "merkl",
    )
    .map(
      (campaign): RewardAprRow => ({
        aprPercent: campaign.aprPercent,
        id: campaign.id,
        source: "merkl",
        tokenSymbols: campaign.rewardTokenSymbol,
      }),
    )
    .sort((a, b) => b.aprPercent - a.aprPercent);
  return [...rows, ...merklRows];
};
