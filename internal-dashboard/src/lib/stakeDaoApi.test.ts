import fetch from "fetch-plus-plus";
import { describe, expect, it, vi } from "vitest";

import {
  fetchStakeDaoStrategiesByGauge,
  stakeDaoRewardsAprPercent,
  type StakeDaoStrategy,
} from "./stakeDaoApi";

vi.mock("fetch-plus-plus", () => ({
  default: vi.fn(),
}));

const strategy: StakeDaoStrategy = {
  apr: { current: { total: 19.25 } },
  gaugeAddress: "0x737e7700e03A8c451C9B72103554a40760F1B57A",
  key: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
  rewards: [{ apr: 0, end: 0, token: { symbol: "CRV" } }],
  tradingApy: 0.25,
};

describe("stakeDaoRewardsAprPercent", function () {
  it("subtracts trading fees from the total APR", function () {
    expect(stakeDaoRewardsAprPercent(strategy)).toBe(19);
  });

  it("returns 0 when the strategy only earns trading fees", function () {
    expect(
      stakeDaoRewardsAprPercent({
        ...strategy,
        apr: { current: { total: 4.5 } },
        tradingApy: 4.5,
      }),
    ).toBe(0);
  });

  it("returns 0 when the APR is missing", function () {
    const { apr, ...withoutApr } = strategy;
    expect(apr).toBeDefined();
    expect(stakeDaoRewardsAprPercent(withoutApr)).toBe(0);
  });
});

describe("fetchStakeDaoStrategiesByGauge", function () {
  it("requests the strategies endpoint with the chain and comma-joined gauges", async function () {
    vi.mocked(fetch).mockResolvedValue([strategy]);

    const result = await fetchStakeDaoStrategiesByGauge({
      chainId: 1,
      gauges: [
        "0x737e7700e03A8c451C9B72103554a40760F1B57A",
        "0x1111111111111111111111111111111111111111",
      ],
    });

    expect(result).toEqual([strategy]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/stakedao/strategies", {
      queryString: {
        chainId: 1,
        gauges:
          "0x737e7700e03A8c451C9B72103554a40760F1B57A,0x1111111111111111111111111111111111111111",
      },
    });
  });
});
