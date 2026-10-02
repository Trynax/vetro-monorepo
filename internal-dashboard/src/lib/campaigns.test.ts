import { describe, expect, it } from "vitest";

import {
  campaignLabel,
  endingSoonThresholdSeconds,
  endsSoon,
  rewardAprRows,
} from "./campaigns";
import { type StakeDaoStrategy } from "./stakeDaoApi";
import { type PoolCampaign } from "./types";

const day = 24 * 60 * 60;

describe("endsSoon", function () {
  it("flags a campaign well inside the window", function () {
    expect(endsSoon(endingSoonThresholdSeconds / 2)).toBe(true);
  });

  it("flags a campaign just inside the boundary", function () {
    expect(endsSoon(endingSoonThresholdSeconds - 1)).toBe(true);
  });

  it("leaves a campaign on the boundary alone", function () {
    expect(endsSoon(endingSoonThresholdSeconds)).toBe(false);
  });

  it("leaves a campaign well outside the window alone", function () {
    expect(endsSoon(endingSoonThresholdSeconds + 30 * day)).toBe(false);
  });
});

const nowSeconds = 1_000_000;

const merklCampaign = {
  aprPercent: 5,
  dailyRewardsUsd: 100,
  endTimestamp: nowSeconds + 3 * day,
  id: "merkl-1",
  name: "VUSD pool",
  rewardTokenSymbol: "VUSD",
  source: "merkl",
  tvlUsd: 1000,
  url: "https://app.merkl.xyz",
} satisfies PoolCampaign;

const stakeDaoCampaign = {
  campaignNumber: 1891,
  endTimestamp: nowSeconds + 30 * day,
  gauge: "0x737e7700e03A8c451C9B72103554a40760F1B57A",
  gaugeChainId: 1,
  id: "stake-dao-1",
  rewardTokenSymbol: "USDC",
  source: "stakeDao",
  totalRewardUsd: 11000,
  usdPerVote: 0.000065,
  weeklyRewardUsd: 211,
} satisfies PoolCampaign;

describe("campaignLabel", function () {
  it("names the source, the reward token and the time left", function () {
    expect(campaignLabel({ campaign: merklCampaign, nowSeconds })).toBe(
      "Merkl · VUSD · 3d",
    );
    expect(campaignLabel({ campaign: stakeDaoCampaign, nowSeconds })).toBe(
      "StakeDAO · USDC · 30d",
    );
  });
});

const stakeDaoStrategy = {
  apr: { current: { total: 19.25 } },
  gaugeAddress: "0x737e7700e03A8c451C9B72103554a40760F1B57A",
  key: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
  rewards: [{ token: { symbol: "CRV" } }],
  tradingApy: 0.25,
} satisfies StakeDaoStrategy;

describe("rewardAprRows", function () {
  it("keeps Merkl campaigns and drops StakeDAO Votemarket campaigns", function () {
    expect(
      rewardAprRows({
        campaigns: [merklCampaign, stakeDaoCampaign],
        stakeDaoStrategy: null,
      }),
    ).toEqual([
      {
        aprPercent: 5,
        id: "merkl-1",
        source: "merkl",
        tokenSymbols: "VUSD",
      },
    ]);
  });

  it("adds the StakeDAO strategy rewards APR and sorts rows by APR descending", function () {
    expect(
      rewardAprRows({
        campaigns: [
          merklCampaign,
          stakeDaoCampaign,
          {
            ...merklCampaign,
            aprPercent: 22.5,
            id: "merkl-2",
            rewardTokenSymbol: "PYUSD",
          },
        ],
        stakeDaoStrategy,
      }),
    ).toEqual([
      {
        aprPercent: 22.5,
        id: "merkl-2",
        source: "merkl",
        tokenSymbols: "PYUSD",
      },
      {
        aprPercent: 19,
        id: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
        source: "stakeDao",
        tokenSymbols: "CRV",
      },
      {
        aprPercent: 5,
        id: "merkl-1",
        source: "merkl",
        tokenSymbols: "VUSD",
      },
    ]);
  });

  it("adds no row for a strategy that earns only trading fees", function () {
    expect(
      rewardAprRows({
        campaigns: [merklCampaign],
        stakeDaoStrategy: {
          ...stakeDaoStrategy,
          apr: { current: { total: 4.5 } },
          tradingApy: 4.5,
        },
      }),
    ).toEqual([
      {
        aprPercent: 5,
        id: "merkl-1",
        source: "merkl",
        tokenSymbols: "VUSD",
      },
    ]);
  });

  it("adds no row for a strategy without APR data", function () {
    const { apr, ...withoutApr } = stakeDaoStrategy;
    expect(apr).toBeDefined();
    expect(
      rewardAprRows({ campaigns: [], stakeDaoStrategy: withoutApr }),
    ).toEqual([]);
  });

  it("joins unique reward symbols in order", function () {
    expect(
      rewardAprRows({
        campaigns: [],
        stakeDaoStrategy: {
          ...stakeDaoStrategy,
          rewards: [
            { token: { symbol: "CRV" } },
            { token: { symbol: "CRV" } },
            { token: { symbol: "PYUSD" } },
          ],
        },
      }),
    ).toEqual([
      {
        aprPercent: 19,
        id: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
        source: "stakeDao",
        tokenSymbols: "CRV/PYUSD",
      },
    ]);
  });

  it("returns no rows without campaigns or a strategy", function () {
    expect(rewardAprRows({ campaigns: [], stakeDaoStrategy: null })).toEqual(
      [],
    );
  });
});
