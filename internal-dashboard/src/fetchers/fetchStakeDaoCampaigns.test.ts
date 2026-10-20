import { type Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCurveCampaigns, type StakeDaoCampaign } from "../lib/stakeDaoApi";
import { type PoolCampaign } from "../lib/types";

import { fetchStakeDaoCampaigns } from "./fetchStakeDaoCampaigns";

vi.mock("../lib/stakeDaoApi", () => ({
  fetchCurveCampaigns: vi.fn(),
}));

const crvUsdGauge: Address = "0x737e7700e03A8c451C9B72103554a40760F1B57A";
const msUsdGauge: Address = "0x28a72343bFf5e10b36E72d86b1041ED2447Dc0Cc";

const week = 7 * 24 * 60 * 60;
// Live check of the Votemarket feed, 2026-10-05.
const nowSeconds = 1791213198;

const campaign = ({
  endTimestamp,
  gauge,
  id,
  isCanceled = false,
  isClosed = false,
}: {
  endTimestamp: number;
  gauge: Address;
  id: number;
  isCanceled?: boolean;
  isClosed?: boolean;
}): StakeDaoCampaign => ({
  currentPeriod: { rewardPerPeriod: "100", rewardPerVote: "0.0001" },
  endTimestamp,
  gauge,
  gaugeChainId: 1,
  id,
  isCanceled,
  isClosed,
  key: `42161-8c2c-14d9-${id}`,
  rewardToken: { price: 1, symbol: "USDC" },
  totalRewardAmount: "1000",
});

// Feed order and end timestamps as served upstream on 2026-10-05.
const liveCampaigns = [
  campaign({ endTimestamp: 1790208000, gauge: crvUsdGauge, id: 1894 }),
  campaign({ endTimestamp: 1784764800, gauge: msUsdGauge, id: 1681 }),
  campaign({ endTimestamp: 1783555200, gauge: msUsdGauge, id: 1714 }),
  campaign({ endTimestamp: 1784764800, gauge: crvUsdGauge, id: 1684 }),
  campaign({ endTimestamp: 1784764800, gauge: msUsdGauge, id: 1739 }),
  campaign({ endTimestamp: 1813795200, gauge: crvUsdGauge, id: 1683 }),
  campaign({ endTimestamp: 1785974400, gauge: msUsdGauge, id: 1796 }),
  campaign({ endTimestamp: 1787788800, gauge: crvUsdGauge, id: 1805 }),
  campaign({ endTimestamp: 1787788800, gauge: msUsdGauge, id: 1806 }),
  campaign({ endTimestamp: 1792627200, gauge: crvUsdGauge, id: 1938 }),
];

const crvUsdKey = "1-0x737e7700e03a8c451c9b72103554a40760f1b57a";

const campaignNumbers = (campaigns: PoolCampaign[] | undefined) =>
  (campaigns ?? []).map((poolCampaign) =>
    poolCampaign.source === "stakeDao" ? poolCampaign.campaignNumber : null,
  );

describe("fetchStakeDaoCampaigns", function () {
  beforeEach(function () {
    vi.useFakeTimers();
    vi.setSystemTime(nowSeconds * 1000);
    vi.mocked(fetchCurveCampaigns).mockReset();
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  it("keeps only campaigns whose vote deadline is still ahead, so VUSD/msUSD gets none", async function () {
    vi.mocked(fetchCurveCampaigns).mockResolvedValue(liveCampaigns);

    const result = await fetchStakeDaoCampaigns([crvUsdGauge, msUsdGauge]);

    expect(Object.keys(result)).toStrictEqual([crvUsdKey]);
    expect(campaignNumbers(result[crvUsdKey])).toStrictEqual([1683, 1938]);
  });

  it("excludes a campaign whose vote deadline is exactly now", async function () {
    vi.mocked(fetchCurveCampaigns).mockResolvedValue([
      campaign({ endTimestamp: nowSeconds + week, gauge: crvUsdGauge, id: 1 }),
      campaign({
        endTimestamp: nowSeconds + week + 1,
        gauge: crvUsdGauge,
        id: 2,
      }),
    ]);

    const result = await fetchStakeDaoCampaigns([crvUsdGauge]);

    expect(Object.keys(result)).toStrictEqual([crvUsdKey]);
    expect(campaignNumbers(result[crvUsdKey])).toStrictEqual([2]);
  });

  it("excludes a closed campaign even with a future vote deadline", async function () {
    vi.mocked(fetchCurveCampaigns).mockResolvedValue([
      campaign({
        endTimestamp: 1813795200,
        gauge: msUsdGauge,
        id: 1683,
        isClosed: true,
      }),
    ]);

    const result = await fetchStakeDaoCampaigns([msUsdGauge]);

    expect(result).toStrictEqual({});
  });

  it("excludes a canceled campaign even with a future vote deadline", async function () {
    vi.mocked(fetchCurveCampaigns).mockResolvedValue([
      campaign({
        endTimestamp: 1813795200,
        gauge: crvUsdGauge,
        id: 1683,
        isCanceled: true,
      }),
      campaign({ endTimestamp: 1792627200, gauge: crvUsdGauge, id: 1938 }),
    ]);

    const result = await fetchStakeDaoCampaigns([crvUsdGauge]);

    expect(Object.keys(result)).toStrictEqual([crvUsdKey]);
    expect(campaignNumbers(result[crvUsdKey])).toStrictEqual([1938]);
  });
});
