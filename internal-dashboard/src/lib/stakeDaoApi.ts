import fetch from "fetch-plus-plus";
import { type Address } from "viem";

type StakeDaoPeriod = {
  rewardPerPeriod: string;
  rewardPerVote: string;
};

export type StakeDaoCampaign = {
  currentPeriod: StakeDaoPeriod;
  endTimestamp: number; // seconds
  gauge: Address;
  gaugeChainId: number;
  id: number;
  isCanceled: boolean;
  isClosed: boolean;
  key: string;
  rewardToken: { price: number; symbol: string };
  totalRewardAmount: string;
};

export type StakeDaoStrategy = {
  // Missing on some upstream entries.
  apr?: { current: { total: number } }; // % incl. trading fees
  gaugeAddress: Address;
  key: string;
  rewards: {
    // Both 0 on the vault's own CRV entry.
    apr: number; // %
    end: number; // seconds
    token: { symbol: string };
  }[];
  tradingApy: number; // %
};

const stakeDaoProxyApiUrl = "/api/stakedao";

export const fetchCurveCampaigns = (
  gauges: string[],
): Promise<StakeDaoCampaign[]> =>
  fetch(`${stakeDaoProxyApiUrl}/campaigns`, {
    queryString: { gauges: gauges.join(",") },
  });

export const fetchStakeDaoStrategiesByGauge = ({
  chainId,
  gauges,
}: {
  chainId: number;
  gauges: Address[];
}): Promise<StakeDaoStrategy[]> =>
  fetch(`${stakeDaoProxyApiUrl}/strategies`, {
    queryString: { chainId, gauges: gauges.join(",") },
  });

// Boosted CRV plus any extra gauge rewards (the v2 feed carries no SDT).
// Trading fees are already part of the pool's own APY, so they are left out
// here, as the StakeDAO app does.
export const stakeDaoRewardsAprPercent = (strategy: StakeDaoStrategy) =>
  strategy.apr ? strategy.apr.current.total - strategy.tradingApy : 0;

export const strategyUrl = (key: string) =>
  `https://app.stakedao.org/strategy?protocol=curve&vault=${encodeURIComponent(key)}`;
