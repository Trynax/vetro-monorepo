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

const noEmission = {
  emissionApy: 0,
  emissionApyMax: 0,
  id: "pool-without-emissions",
};

const msUsdPoolId = "0x8bEA2a46D56c321A216F97Ab6b61C34098B819d2";

const emission = {
  emissionApy: 6.75,
  emissionApyMax: 16.875,
  id: msUsdPoolId,
};

const crvRow = {
  aprPercent: 6.75,
  aprPercentMax: 16.875,
  id: `curve-gauge-${msUsdPoolId}`,
  source: "curveGauge",
  tokenSymbols: "CRV",
};

describe("rewardAprRows", function () {
  it("shows the gauge CRV range alone when there are no other rewards", function () {
    expect(
      rewardAprRows({ campaigns: [], emission, stakeDaoStrategy: null }),
    ).toStrictEqual([
      {
        aprPercent: 6.75,
        aprPercentMax: 16.875,
        id: "curve-gauge-0x8bEA2a46D56c321A216F97Ab6b61C34098B819d2",
        source: "curveGauge",
        tokenSymbols: "CRV",
      },
    ]);
  });

  it("orders gauge CRV, then StakeDAO, then Merkl regardless of APR", function () {
    expect(
      rewardAprRows({
        campaigns: [
          merklCampaign,
          {
            ...merklCampaign,
            aprPercent: 22.5,
            id: "merkl-2",
            rewardTokenSymbol: "PYUSD",
          },
          stakeDaoCampaign,
        ],
        emission,
        stakeDaoStrategy,
      }),
    ).toStrictEqual([
      crvRow,
      {
        aprPercent: 19,
        id: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
        source: "stakeDao",
        tokenSymbols: "CRV",
      },
      {
        aprPercent: 22.5,
        id: "merkl-2",
        source: "merkl",
        tokenSymbols: "PYUSD",
      },
      {
        aprPercent: 5,
        id: "merkl-1",
        source: "merkl",
        tokenSymbols: "VUSD",
      },
    ]);
  });

  it("adds no CRV row when the gauge has no emissions", function () {
    expect(
      rewardAprRows({
        campaigns: [stakeDaoCampaign],
        emission: { emissionApy: 0, emissionApyMax: 0, id: msUsdPoolId },
        stakeDaoStrategy,
      }),
    ).toStrictEqual([
      {
        aprPercent: 19,
        id: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
        source: "stakeDao",
        tokenSymbols: "CRV",
      },
    ]);
  });

  it("keeps only the CRV row when the StakeDAO strategy has a 0 rewards APR", function () {
    expect(
      rewardAprRows({
        campaigns: [stakeDaoCampaign],
        emission,
        stakeDaoStrategy: {
          ...stakeDaoStrategy,
          apr: { current: { total: 0.25 } },
          tradingApy: 0.25,
        },
      }),
    ).toStrictEqual([crvRow]);
  });

  // VUSD/msUSD has a live StakeDAO strategy, but all its Votemarket campaigns
  // are past their vote deadline, so it shows no StakeDAO row.
  it("shows only CRV for VUSD/msUSD: live strategy but no active Votemarket campaign", function () {
    expect(
      rewardAprRows({
        campaigns: [],
        emission: {
          emissionApy: 6.79,
          emissionApyMax: 16.99,
          id: msUsdPoolId,
        },
        stakeDaoStrategy: {
          apr: { current: { total: 7.871434679506586 } },
          gaugeAddress: "0x28a72343bFf5e10b36E72d86b1041ED2447Dc0Cc",
          key: "1-0x757360820728819953937b752f6b83aeb11090c7",
          rewards: [{ token: { symbol: "CRV" } }],
          tradingApy: 0.01,
        },
      }),
    ).toStrictEqual([
      {
        aprPercent: 6.79,
        aprPercentMax: 16.99,
        id: "curve-gauge-0x8bEA2a46D56c321A216F97Ab6b61C34098B819d2",
        source: "curveGauge",
        tokenSymbols: "CRV",
      },
    ]);
  });

  // VUSD/crvUSD has a live StakeDAO strategy and running Votemarket campaigns.
  it("shows CRV and the StakeDAO strategy for VUSD/crvUSD with an active Votemarket campaign", function () {
    const crvUsdPoolId = "0xAFbA5800252530CE71b03Ba2BCa2Dd5aE44a7F3d";
    const total = 18.423951191461402;
    const tradingApy = 0.08;
    expect(
      rewardAprRows({
        campaigns: [stakeDaoCampaign],
        emission: {
          emissionApy: 15.25,
          emissionApyMax: 38.12,
          id: crvUsdPoolId,
        },
        stakeDaoStrategy: {
          apr: { current: { total } },
          gaugeAddress: "0x737e7700e03A8c451C9B72103554a40760F1B57A",
          key: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
          rewards: [{ token: { symbol: "CRV" } }],
          tradingApy,
        },
      }),
    ).toStrictEqual([
      {
        aprPercent: 15.25,
        aprPercentMax: 38.12,
        id: "curve-gauge-0xAFbA5800252530CE71b03Ba2BCa2Dd5aE44a7F3d",
        source: "curveGauge",
        tokenSymbols: "CRV",
      },
      {
        aprPercent: 18.423951191461402 - 0.08,
        id: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
        source: "stakeDao",
        tokenSymbols: "CRV",
      },
    ]);
  });

  it("adds no StakeDAO row when the pool has only Merkl campaigns", function () {
    expect(
      rewardAprRows({
        campaigns: [merklCampaign],
        emission,
        stakeDaoStrategy,
      }),
    ).toStrictEqual([
      crvRow,
      {
        aprPercent: 5,
        id: "merkl-1",
        source: "merkl",
        tokenSymbols: "VUSD",
      },
    ]);
  });

  it("never turns a Votemarket campaign into a StakeDAO row", function () {
    expect(
      rewardAprRows({
        campaigns: [stakeDaoCampaign],
        emission,
        stakeDaoStrategy: null,
      }),
    ).toStrictEqual([crvRow]);
    expect(
      rewardAprRows({
        campaigns: [stakeDaoCampaign],
        emission: noEmission,
        stakeDaoStrategy: null,
      }),
    ).toStrictEqual([]);
  });

  it("keeps Merkl campaigns and drops StakeDAO Votemarket campaigns", function () {
    expect(
      rewardAprRows({
        campaigns: [merklCampaign, stakeDaoCampaign],
        emission: noEmission,
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

  it("puts the StakeDAO strategy before Merkl campaigns sorted by APR descending", function () {
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
        emission: noEmission,
        stakeDaoStrategy,
      }),
    ).toEqual([
      {
        aprPercent: 19,
        id: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
        source: "stakeDao",
        tokenSymbols: "CRV",
      },
      {
        aprPercent: 22.5,
        id: "merkl-2",
        source: "merkl",
        tokenSymbols: "PYUSD",
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
        campaigns: [merklCampaign, stakeDaoCampaign],
        emission: noEmission,
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
      rewardAprRows({
        campaigns: [stakeDaoCampaign],
        emission: noEmission,
        stakeDaoStrategy: withoutApr,
      }),
    ).toEqual([]);
  });

  it("joins unique reward symbols in order", function () {
    expect(
      rewardAprRows({
        campaigns: [stakeDaoCampaign],
        emission: noEmission,
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
    expect(
      rewardAprRows({
        campaigns: [],
        emission: noEmission,
        stakeDaoStrategy: null,
      }),
    ).toEqual([]);
  });
});
