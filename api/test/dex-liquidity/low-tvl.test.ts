import type { DexPool, DexPoolReward } from "@vetro-protocol/core";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";

import { excludeLowTvlPools } from "../../src/dex-liquidity/low-tvl.ts";

const crv = "0xD533a949740bb3306d119CC777fa900bA034cd52";
const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const sdt = "0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F";
const gaugeAddress = "0x2222222222222222222222222222222222222222";

const curveGaugeReward: DexPoolReward = {
  apr: 2,
  source: "curveGauge",
  sourceMetadata: { gaugeAddress },
  tokens: [{ address: crv, chainId: 1 }],
};

const merklReward: DexPoolReward = {
  apr: 3,
  source: "merkl",
  sourceMetadata: {
    campaignId: `0x${"1".repeat(64)}`,
    opportunityId: "opportunity",
  },
  tokens: [{ address: usdc, chainId: 1 }],
};

const stakeDaoReward: DexPoolReward = {
  apr: 4,
  source: "stakeDao",
  sourceMetadata: { strategyKey: "1-0xstrategy" },
  tokens: [{ address: sdt, chainId: 1 }],
};

const poolAddress = (digit: string): Address => `0x${digit.repeat(40)}`;

const buildPool = ({
  address = poolAddress("1"),
  chainId = 1,
  range,
  rewards = [],
  tvlUsd,
  volumeUsd24h = 0,
}: {
  address?: Address;
  chainId?: number;
  range?: DexPool["range"];
  rewards?: DexPoolReward[];
  tvlUsd: number | null;
  volumeUsd24h?: number;
}): DexPool => ({
  address,
  apr: null,
  chainId,
  coins: [],
  dex: "sushi",
  range,
  rewards,
  tvlUsd,
  volumeUsd24h,
});

describe("dex-liquidity/excludeLowTvlPools", function () {
  it("keeps a pool with a TVL of exactly 500 and no rewards", function () {
    const pool = buildPool({ tvlUsd: 500 });
    expect(excludeLowTvlPools([pool])).toEqual([pool]);
  });

  it("drops a pool with a TVL below 500 and no rewards", function () {
    const pool = buildPool({ tvlUsd: 499.99 });
    expect(excludeLowTvlPools([pool])).toEqual([]);
  });

  it.each([
    ["curveGauge", curveGaugeReward],
    ["merkl", merklReward],
    ["stakeDao", stakeDaoReward],
  ])(
    "keeps a low TVL pool with a %s reward",
    function (_source, reward: DexPoolReward) {
      const pool = buildPool({ rewards: [reward], tvlUsd: 10 });
      expect(excludeLowTvlPools([pool])).toEqual([pool]);
    },
  );

  it("drops a pool with an unknown TVL and no rewards", function () {
    const pool = buildPool({ tvlUsd: null });
    expect(excludeLowTvlPools([pool])).toEqual([]);
  });

  it("keeps a pool with an unknown TVL and a reward", function () {
    const pool = buildPool({ rewards: [merklReward], tvlUsd: null });
    expect(excludeLowTvlPools([pool])).toEqual([pool]);
  });

  it("ignores the volume", function () {
    const pool = buildPool({ tvlUsd: 100, volumeUsd24h: 1_000_000 });
    expect(excludeLowTvlPools([pool])).toEqual([]);
  });

  it("keeps the range rows of a pool whose full-range row is kept", function () {
    const fullRange = buildPool({ tvlUsd: 1000 });
    const rangeRow = buildPool({
      range: { lowerPrice: 0.99, upperPrice: 1.01 },
      tvlUsd: 100,
    });
    expect(excludeLowTvlPools([fullRange, rangeRow])).toEqual([
      fullRange,
      rangeRow,
    ]);
  });

  it("drops the range rows of a pool whose full-range row is dropped", function () {
    const fullRange = buildPool({ tvlUsd: 100 });
    const rangeRow = buildPool({
      range: { lowerPrice: 0.99, upperPrice: 1.01 },
      tvlUsd: 600,
    });
    expect(excludeLowTvlPools([fullRange, rangeRow])).toEqual([]);
  });

  it("matches range rows to their full-range row regardless of address case", function () {
    const fullRange = buildPool({ address: crv, tvlUsd: 1000 });
    const rangeRow = buildPool({
      address: crv.toLowerCase() as Address,
      range: { lowerPrice: 0.99, upperPrice: 1.01 },
      tvlUsd: 100,
    });
    expect(excludeLowTvlPools([fullRange, rangeRow])).toEqual([
      fullRange,
      rangeRow,
    ]);
  });

  it("does not match pools at the same address on another chain", function () {
    const visibleMainnet = buildPool({ chainId: 1, tvlUsd: 1000 });
    const lowTvlHemi = buildPool({ chainId: 43111, tvlUsd: 100 });
    const lowTvlHemiRange = buildPool({
      chainId: 43111,
      range: { lowerPrice: 0.99, upperPrice: 1.01 },
      tvlUsd: 50,
    });
    expect(
      excludeLowTvlPools([visibleMainnet, lowTvlHemi, lowTvlHemiRange]),
    ).toEqual([visibleMainnet]);
  });

  it("keeps the input order", function () {
    const first = buildPool({ address: poolAddress("3"), tvlUsd: 800 });
    const dropped = buildPool({ address: poolAddress("4"), tvlUsd: 20 });
    const second = buildPool({
      address: poolAddress("5"),
      rewards: [stakeDaoReward],
      tvlUsd: 0,
    });
    const firstRange = buildPool({
      address: poolAddress("3"),
      range: { lowerPrice: 0.9, upperPrice: 1.1 },
      tvlUsd: 10,
    });
    const third = buildPool({ address: poolAddress("6"), tvlUsd: 5000 });
    expect(
      excludeLowTvlPools([first, dropped, second, firstRange, third]),
    ).toEqual([first, second, firstRange, third]);
  });
});
