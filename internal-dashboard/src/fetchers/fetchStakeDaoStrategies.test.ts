import { QueryClient } from "@tanstack/react-query";
import { type Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackedPoolsOptions } from "../hooks/useTrackedPools";
import {
  fetchStakeDaoStrategiesByGauge,
  type StakeDaoStrategy,
} from "../lib/stakeDaoApi";
import { type TrackedPool } from "../lib/types";

import { fetchStakeDaoStrategies } from "./fetchStakeDaoStrategies";

vi.mock("../lib/stakeDaoApi", () => ({
  fetchStakeDaoStrategiesByGauge: vi.fn(),
}));

const crvUsdGauge: Address = "0x737e7700e03A8c451C9B72103554a40760F1B57A";
const unmatchedGauge: Address = "0x4444444444444444444444444444444444444444";
const optimismGauge: Address = "0x5555555555555555555555555555555555555555";

const pool = ({
  chainId = 1,
  dex,
  gaugeAddress,
  id,
}: {
  chainId?: number;
  dex: TrackedPool["dex"];
  gaugeAddress: Address | undefined;
  id: string;
}): TrackedPool => ({
  address: `0x${"2".repeat(40)}`,
  baseApy: undefined,
  chainId,
  coins: [],
  dex,
  emissionApy: 0,
  emissionApyMax: 0,
  gaugeAddress,
  id,
  lpTokenAddress: undefined,
  name: id,
  poolType: "factory-stable-ng",
  tvlUsd: undefined,
  url: "https://example.com",
  virtualPrice: 1,
  volumeUsd24h: 0,
});

const crvUsdStrategy: StakeDaoStrategy = {
  apr: { current: { total: 19.25 } },
  // Lowercase on purpose: matching must not depend on letter case.
  gaugeAddress: crvUsdGauge.toLowerCase() as Address,
  key: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
  rewards: [{ token: { symbol: "CRV" } }],
  tradingApy: 0.25,
};

const otherStrategy: StakeDaoStrategy = {
  apr: { current: { total: 7 } },
  gaugeAddress: "0x6666666666666666666666666666666666666666",
  key: "1-0x6666666666666666666666666666666666666666",
  rewards: [{ token: { symbol: "CRV" } }],
  tradingApy: 1,
};

const seededClient = function (pools: TrackedPool[]) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(trackedPoolsOptions().queryKey, pools);
  return queryClient;
};

describe("fetchStakeDaoStrategies", function () {
  beforeEach(function () {
    vi.mocked(fetchStakeDaoStrategiesByGauge).mockReset();
  });

  it("maps Curve pools to their strategy by gauge and skips the rest", async function () {
    vi.mocked(fetchStakeDaoStrategiesByGauge).mockResolvedValue([
      otherStrategy,
      crvUsdStrategy,
    ]);
    const queryClient = seededClient([
      pool({ dex: "curve", gaugeAddress: crvUsdGauge, id: "curve-matched" }),
      pool({ dex: "curve", gaugeAddress: undefined, id: "curve-no-gauge" }),
      pool({ dex: "sushi", gaugeAddress: crvUsdGauge, id: "sushi" }),
      pool({
        dex: "curve",
        gaugeAddress: unmatchedGauge,
        id: "curve-unmatched",
      }),
    ]);

    const result = await fetchStakeDaoStrategies(queryClient);

    expect(result).toEqual({ "curve-matched": crvUsdStrategy });
    expect(result["curve-matched"]).toBe(crvUsdStrategy);
    expect(fetchStakeDaoStrategiesByGauge).toHaveBeenCalledTimes(1);
    expect(fetchStakeDaoStrategiesByGauge).toHaveBeenCalledWith({
      chainId: 1,
      gauges: [crvUsdGauge, unmatchedGauge],
    });
  });

  it("calls the API once per chain and matches strategies on the same chain", async function () {
    const optimismStrategy: StakeDaoStrategy = {
      ...otherStrategy,
      gaugeAddress: optimismGauge,
      key: `10-${optimismGauge.toLowerCase()}`,
    };
    vi.mocked(fetchStakeDaoStrategiesByGauge).mockImplementation(
      async ({ chainId }) =>
        chainId === 1 ? [crvUsdStrategy] : [optimismStrategy],
    );
    const queryClient = seededClient([
      pool({ dex: "curve", gaugeAddress: crvUsdGauge, id: "mainnet" }),
      pool({
        chainId: 10,
        dex: "curve",
        gaugeAddress: optimismGauge,
        id: "optimism",
      }),
      // Same gauge as the mainnet pool, but the chain 10 response has no
      // strategy for it, so it must not borrow the mainnet one.
      pool({
        chainId: 10,
        dex: "curve",
        gaugeAddress: crvUsdGauge,
        id: "optimism-crvusd",
      }),
    ]);

    const result = await fetchStakeDaoStrategies(queryClient);

    expect(result).toEqual({
      mainnet: crvUsdStrategy,
      optimism: optimismStrategy,
    });
    expect(fetchStakeDaoStrategiesByGauge).toHaveBeenCalledTimes(2);
    expect(fetchStakeDaoStrategiesByGauge).toHaveBeenCalledWith({
      chainId: 1,
      gauges: [crvUsdGauge],
    });
    expect(fetchStakeDaoStrategiesByGauge).toHaveBeenCalledWith({
      chainId: 10,
      gauges: [optimismGauge, crvUsdGauge],
    });
  });

  it("returns an empty map without calling the API when no Curve pool has a gauge", async function () {
    const queryClient = seededClient([
      pool({ dex: "curve", gaugeAddress: undefined, id: "curve-no-gauge" }),
      pool({ dex: "sushi", gaugeAddress: crvUsdGauge, id: "sushi" }),
    ]);

    const result = await fetchStakeDaoStrategies(queryClient);

    expect(result).toEqual({});
    expect(fetchStakeDaoStrategiesByGauge).not.toHaveBeenCalled();
  });
});
