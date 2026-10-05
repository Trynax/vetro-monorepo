import { type Token } from "@vetro-protocol/core";
import { type Address } from "viem";

import { type Dex } from "../config/dexes";

// Normalized, venue-agnostic shapes the UI consumes. Each DEX source (Curve
// today) maps its own API onto these, so the rest of the app stays venue-neutral.

export type PoolCoin = {
  address: Address;
  // Raw on-chain balance in the token's smallest unit. Convert for display with
  // formatUnits(balance, decimals); USD value is balance * usdPrice, derived
  // where needed rather than stored.
  balance: bigint;
  decimals: number;
  symbol: string;
  usdPrice: number | undefined;
};

export type TrackedPool = {
  address: Address;
  baseApy: number | undefined; // % from trading fees, undefined when the TVL is unknown
  chainId: number;
  coins: PoolCoin[];
  dex: Dex; // venue this pool belongs to
  // APR % from the venue's own emissions to LPs (Curve gauge CRV), unboosted /
  // max boost. 0 for venues without emissions. Shown as a Rewards APR line, not
  // as part of Pool APY.
  emissionApy: number;
  emissionApyMax: number;
  // Rolling-24h trading fees in USD, when the venue's API hands them to us
  // directly (Sushi). Undefined for venues whose fees are fetched on demand
  // instead (Curve), so the details page knows to fetch per-pool.
  feesUsd24h?: number;
  // Contract distributing incentives (a Curve gauge). Venue-specific and
  // optional — not every DEX exposes one.
  gaugeAddress: Address | undefined;
  // Unique key for routing/list keys. Usually the address, but a pool can appear
  // more than once (e.g. a Sushi pool listed both full-range and for a price band),
  // so the id disambiguates those entries while `address` stays the real pool.
  id: string;
  // A derived sub-range view of another entry (e.g. liquidity within a price band).
  // Excluded from token-distribution stats so its liquidity isn't double-counted.
  isRangeView?: boolean;
  lpTokenAddress: Address | undefined;
  name: string;
  poolType: string; // venue's own classification (e.g. Curve registry id)
  rangeLabel?: string; // short label for the view (e.g. "Full range", "$0.96–$1.04")
  tvlUsd: number | undefined;
  url: string; // the pool's page on its DEX
  virtualPrice: number;
  volumeUsd24h: number;
};

export type TrackedToken = Pick<
  Token,
  "address" | "decimals" | "extensions" | "symbol"
>;

export type WhitelistedToken = Pick<Token, "address" | "decimals" | "symbol">;

type PoolCampaignBase = {
  endTimestamp: number; // seconds
  id: string;
  rewardTokenSymbol: string;
};

export type MerklPoolCampaign = PoolCampaignBase & {
  aprPercent: number;
  dailyRewardsUsd: number;
  name: string;
  protocolAprPercent?: number;
  source: "merkl";
  tvlUsd: number;
  url: string;
};

export type StakeDaoPoolCampaign = PoolCampaignBase & {
  campaignNumber: number;
  source: "stakeDao";
  totalRewardUsd: number;
  usdPerVote: number;
  weeklyRewardUsd: number;
};

export type PoolCampaign = MerklPoolCampaign | StakeDaoPoolCampaign;

export type GaugeEmission = {
  estCrvPerDay: number; // estimated CRV directed to this gauge per day
  inflationRate: number; // network-wide CRV emitted per second
  relativeWeight: number; // 0..1 share of emissions assigned to this gauge
};
