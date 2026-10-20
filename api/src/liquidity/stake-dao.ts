import fetchJson from "tiny-fetch-json";
import { type Address, checksumAddress } from "viem";

const campaignsUrl = "https://api-v3.stakedao.org/votemarket/curve";
const strategiesUrl = (chainId: number) =>
  `https://api.stakedao.org/api/strategies/v2/curve/${chainId}.json`;

type Campaign = {
  endTimestamp: number;
  gauge: Address;
  gaugeChainId: number;
  isCanceled: boolean;
  isClosed: boolean;
};

export type StakeDaoStrategy = {
  apr?: { current: { total: number } };
  chainId: number;
  gaugeAddress: Address | null;
  key: string;
  rewards: {
    apr: number;
    end: number;
    token: { address: Address };
  }[];
  tradingApy: number;
};

const week = 7 * 24 * 60 * 60;

// Votes close one week before the campaign ends.
const isRunning = ({
  campaign,
  nowSeconds,
}: {
  campaign: Campaign;
  nowSeconds: number;
}) =>
  !campaign.isCanceled &&
  !campaign.isClosed &&
  campaign.endTimestamp - week > nowSeconds;

/**
 * Gets the gauges that have a running Votemarket campaign.
 */
export async function getCampaignGauges(nowSeconds: number) {
  const { campaigns } = (await fetchJson(campaignsUrl)) as {
    campaigns: Campaign[];
  };
  return campaigns
    .filter((campaign) => isRunning({ campaign, nowSeconds }))
    .map((campaign) => ({
      chainId: campaign.gaugeChainId,
      gauge: checksumAddress(campaign.gauge),
    }));
}

export const getStrategies = (chainId: number) =>
  fetchJson(strategiesUrl(chainId)) as Promise<StakeDaoStrategy[]>;

export const strategyRewardsApr = (strategy: StakeDaoStrategy) =>
  strategy.apr ? strategy.apr.current.total - strategy.tradingApy : 0;
