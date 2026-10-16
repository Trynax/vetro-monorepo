import type { DexPool } from "@vetro-protocol/core";
import type { Hash } from "viem";
import { describe, expect, it } from "vitest";

import {
  addIncentives,
  type IncentiveSources,
} from "../../src/liquidity/incentives.ts";

const nowSeconds = 1_000_000;
const crv = "0xD533a949740bb3306d119CC777fa900bA034cd52";
const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const sdt = "0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F";
const poolAddress = "0x1111111111111111111111111111111111111111";
const gaugeAddress = "0x2222222222222222222222222222222222222222";
const lpTokenAddress = "0x3333333333333333333333333333333333333333";

const campaignId = (digit: string): Hash => `0x${digit.repeat(64)}`;
const highCampaignId = campaignId("2");

const curveGaugeReward: DexPool["rewards"][number] = {
  apr: 2,
  aprMax: 5,
  source: "curveGauge",
  sourceMetadata: { gaugeAddress },
  tokens: [{ address: crv, chainId: 1 }],
};

const curvePool: DexPool = {
  address: poolAddress,
  apr: 1,
  chainId: 1,
  coins: [],
  dex: "curve",
  dexMetadata: { gaugeAddress, lpTokenAddress, poolId: "factory-stable-ng-1" },
  rewards: [curveGaugeReward],
  tvlUsd: 1000,
  volumeUsd24h: 10,
};

const strategy: IncentiveSources["strategies"][number] = {
  apr: { current: { total: 19.25 } },
  chainId: 1,
  gaugeAddress,
  key: "1-0xstrategy",
  rewards: [
    { apr: 0, end: 0, token: { address: crv } },
    { apr: 3, end: nowSeconds + 100, token: { address: sdt } },
    { apr: 3, end: nowSeconds - 100, token: { address: usdc } },
  ],
  tradingApy: 0.25,
};

const merklReward = ({
  apr,
  id,
}: {
  apr: number;
  id: Hash;
}): IncentiveSources["merklRewards"][number] => ({
  apr,
  campaignId: id,
  chainId: 1,
  identifier: poolAddress,
  opportunityId: "opportunity",
  token: { address: usdc, chainId: 1 },
});

const noSources: IncentiveSources = {
  campaignGauges: [],
  merklRewards: [],
  strategies: [],
};

describe("liquidity/addIncentives", function () {
  it("keeps the pool and the venue rewards when there is nothing to add", function () {
    const pool = addIncentives({
      nowSeconds,
      pool: curvePool,
      sources: noSources,
    });

    expect(pool).toEqual(curvePool);
  });

  it("adds the StakeDAO strategy only while a Votemarket campaign runs on the gauge", function () {
    const withoutCampaign = addIncentives({
      nowSeconds,
      pool: curvePool,
      sources: { ...noSources, strategies: [strategy] },
    });
    const withCampaign = addIncentives({
      nowSeconds,
      pool: curvePool,
      sources: {
        ...noSources,
        campaignGauges: [{ chainId: 1, gauge: gaugeAddress }],
        strategies: [strategy],
      },
    });

    expect(withoutCampaign.rewards.map((reward) => reward.source)).toEqual([
      "curveGauge",
    ]);
    expect(withCampaign.rewards[1]).toEqual({
      apr: 19,
      source: "stakeDao",
      sourceMetadata: { strategyKey: "1-0xstrategy" },
      tokens: [
        { address: crv, chainId: 1 },
        { address: sdt, chainId: 1 },
      ],
    });
  });

  it("adds no StakeDAO reward for a strategy that earns only trading fees", function () {
    const pool = addIncentives({
      nowSeconds,
      pool: curvePool,
      sources: {
        ...noSources,
        campaignGauges: [{ chainId: 1, gauge: gaugeAddress }],
        strategies: [{ ...strategy, apr: { current: { total: 0.25 } } }],
      },
    });

    expect(pool.rewards.map((reward) => reward.source)).toEqual(["curveGauge"]);
  });

  it("puts the Merkl campaigns last, by APR, and matches them by the gauge or LP token too", function () {
    const pool = addIncentives({
      nowSeconds,
      pool: curvePool,
      sources: {
        ...noSources,
        merklRewards: [
          merklReward({ apr: 3, id: campaignId("1") }),
          {
            ...merklReward({ apr: 9, id: highCampaignId }),
            identifier: lpTokenAddress,
          },
          {
            ...merklReward({ apr: 5, id: campaignId("3") }),
            chainId: 43111,
          },
          {
            ...merklReward({ apr: 7, id: campaignId("4") }),
            identifier: "0x4444444444444444444444444444444444444444",
          },
        ],
      },
    });

    expect(pool.rewards.map((reward) => reward.apr)).toEqual([2, 9, 3]);
    expect(pool.rewards[1]).toEqual({
      apr: 9,
      source: "merkl",
      sourceMetadata: {
        campaignId: highCampaignId,
        opportunityId: "opportunity",
      },
      tokens: [{ address: usdc, chainId: 1 }],
    });
  });
});
