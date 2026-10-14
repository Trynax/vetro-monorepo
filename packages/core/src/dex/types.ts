import type { Address, Hash } from "viem";

type PoolCoin = { address: Address; amount: number };

export type DexPoolRange = { lowerPrice: number; upperPrice: number };

export type DexRewardToken = { address: Address; chainId: number };

export type DexPoolReward = {
  apr: number;
  aprMax?: number;
  tokens: DexRewardToken[];
} & (
  | { source: "curveGauge"; sourceMetadata: { gaugeAddress: Address } }
  | {
      source: "merkl";
      sourceMetadata: { campaignId: Hash; opportunityId: string };
    }
  | { source: "stakeDao"; sourceMetadata: { strategyKey: string } }
);

type PoolDex =
  | { dex: "brownfi"; dexMetadata: { fee: number; overrideFee: number } }
  | {
      dex: "curve";
      dexMetadata: {
        gaugeAddress?: Address;
        lpTokenAddress?: Address;
        poolId: string;
      };
    }
  | { dex: "sushi" | "uniswap" };

export type DexPool = {
  address: Address;
  apr: number | null;
  chainId: number;
  coins: PoolCoin[];
  range?: DexPoolRange;
  rewards: DexPoolReward[];
  tvlUsd: number | null;
  volumeUsd24h: number;
} & PoolDex;
