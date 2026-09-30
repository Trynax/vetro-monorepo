import { getAddress } from "viem";
import { describe, expect, it, vi } from "vitest";

import { fetchAllPools, fetchVolumes } from "../lib/curveApi";

import { fetchCurvePools } from "./fetchCurvePools";

vi.mock("../lib/curveApi", () => ({
  fetchAllPools: vi.fn(),
  fetchVolumes: vi.fn(),
}));

const vetBtc = "0x1111111111111111111111111111111111111111";
const wbtc = "0x2222222222222222222222222222222222222222";
const poolAddress = "0x3333333333333333333333333333333333333333";

const curvePool = {
  address: poolAddress,
  coins: [
    {
      address: vetBtc,
      decimals: "18",
      poolBalance: "26900000000000000",
      symbol: "vetBTC",
      usdPrice: null,
    },
    {
      address: wbtc,
      decimals: "8",
      poolBalance: "1835411",
      symbol: "WBTC",
      usdPrice: 83_304,
    },
  ],
  gaugeCrvApy: [],
  name: "vetBTC/WBTC",
  registryId: "factory-stable-ng",
  usdTotal: 1528.97,
  virtualPrice: "1000000000000000000",
};

describe("fetchCurvePools", function () {
  it("maps a null Curve coin price to undefined", async function () {
    vi.mocked(fetchAllPools).mockResolvedValue([curvePool]);
    vi.mocked(fetchVolumes).mockResolvedValue([]);

    const [pool] = await fetchCurvePools(new Set([vetBtc]));

    expect(pool.coins).toEqual([
      {
        address: getAddress(vetBtc),
        balance: 26_900_000_000_000_000n,
        decimals: 18,
        symbol: "vetBTC",
        usdPrice: undefined,
      },
      {
        address: getAddress(wbtc),
        balance: 1_835_411n,
        decimals: 8,
        symbol: "WBTC",
        usdPrice: 83_304,
      },
    ]);
    expect(pool.coins[0].usdPrice).toBeUndefined();
    expect(pool.tvlUsd).toBe(1528.97);
  });

  it("keeps a zero Curve coin price as zero", async function () {
    vi.mocked(fetchAllPools).mockResolvedValue([
      {
        ...curvePool,
        coins: [{ ...curvePool.coins[0], usdPrice: 0 }, curvePool.coins[1]],
      },
    ]);
    vi.mocked(fetchVolumes).mockResolvedValue([]);

    const [pool] = await fetchCurvePools(new Set([vetBtc]));

    expect(pool.coins[0].usdPrice).toBe(0);
  });
});
