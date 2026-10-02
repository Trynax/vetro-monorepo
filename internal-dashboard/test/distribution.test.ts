import { type Address } from "viem";
import { hemi, mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";

import { computeDistributions } from "../src/lib/distribution.ts";
import {
  type PoolCoin,
  type TrackedPool,
  type TrackedToken,
} from "../src/lib/types.ts";

const tokenA: Address = "0x1111111111111111111111111111111111111111";
const tokenB: Address = "0x2222222222222222222222222222222222222222";
const tokenC: Address = "0x3333333333333333333333333333333333333333";

const vusdMainnet: Address = "0xCa83DDE9c22254f58e771bE5E157773212AcBAc3";
const vusdHemi: Address = "0xD3599AE62EE280709A22268a46d23164214e345B";

const makeToken = ({
  address,
  symbol,
}: {
  address: Address;
  symbol: string;
}): TrackedToken => ({ address, decimals: 18, symbol });

const symbolByAddress: Record<string, string> = {
  [tokenA]: "A",
  [tokenB]: "B",
  [tokenC]: "C",
};

const makeCoin = ({
  address,
  balance,
  symbol = symbolByAddress[address],
}: {
  address: Address;
  balance: bigint;
  symbol?: string;
}): PoolCoin => ({ address, balance, decimals: 18, symbol, usdPrice: 1 });

const makePool = ({
  address,
  chainId = mainnet.id,
  coins,
}: {
  address: Address;
  chainId?: number;
  coins: PoolCoin[];
}): TrackedPool => ({
  address,
  baseApy: 0,
  chainId,
  coins,
  dex: "curve",
  emissionApy: 0,
  emissionApyMax: 0,
  gaugeAddress: undefined,
  id: address,
  lpTokenAddress: undefined,
  name: `pool-${address}`,
  poolType: "stableswap",
  tvlUsd: 0,
  url: "https://example.com",
  virtualPrice: 1,
  volumeUsd24h: 0,
});

const poolOne: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const poolTwo: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const poolThree: Address = "0xcccccccccccccccccccccccccccccccccccccccc";

describe("distribution/computeDistributions", function () {
  it("returns one distribution per token, preserving token order", function () {
    const tokens = [
      makeToken({ address: tokenA, symbol: "A" }),
      makeToken({ address: tokenB, symbol: "B" }),
    ];
    const result = computeDistributions({ pools: [], tokens });

    expect(result).toHaveLength(2);
    expect(result[0].token.symbol).toBe("A");
    expect(result[1].token.symbol).toBe("B");
  });

  it("produces an empty distribution for a token held by no pool", function () {
    const pools = [
      makePool({
        address: poolOne,
        coins: [makeCoin({ address: tokenB, balance: 100n })],
      }),
    ];
    const [distribution] = computeDistributions({
      pools,
      tokens: [makeToken({ address: tokenA, symbol: "A" })],
    });

    expect(distribution.slices).toEqual([]);
    expect(distribution.totalBalance).toBe(0n);
  });

  it("produces a single full-share slice when only one pool holds the token", function () {
    const pools = [
      makePool({
        address: poolOne,
        coins: [makeCoin({ address: tokenA, balance: 500n })],
      }),
    ];
    const [distribution] = computeDistributions({
      pools,
      tokens: [makeToken({ address: tokenA, symbol: "A" })],
    });

    expect(distribution.totalBalance).toBe(500n);
    expect(distribution.slices).toHaveLength(1);
    expect(distribution.slices[0].balance).toBe(500n);
    expect(distribution.slices[0].share).toBe(1);
  });

  it("splits liquidity across pools as shares that sum to 1", function () {
    const pools = [
      makePool({
        address: poolOne,
        coins: [makeCoin({ address: tokenA, balance: 30n })],
      }),
      makePool({
        address: poolTwo,
        coins: [makeCoin({ address: tokenA, balance: 70n })],
      }),
    ];
    const [distribution] = computeDistributions({
      pools,
      tokens: [makeToken({ address: tokenA, symbol: "A" })],
    });

    expect(distribution.totalBalance).toBe(100n);
    expect(distribution.slices).toHaveLength(2);
    expect(distribution.slices.map((slice) => slice.share)).toEqual([0.7, 0.3]);
    const shareSum = distribution.slices.reduce(
      (sum, slice) => sum + slice.share,
      0,
    );
    expect(shareSum).toBeCloseTo(1, 12);
  });

  it("sorts slices by balance, largest first", function () {
    const pools = [
      makePool({
        address: poolOne,
        coins: [makeCoin({ address: tokenA, balance: 10n })],
      }),
      makePool({
        address: poolTwo,
        coins: [makeCoin({ address: tokenA, balance: 90n })],
      }),
      makePool({
        address: poolThree,
        coins: [makeCoin({ address: tokenA, balance: 50n })],
      }),
    ];
    const [distribution] = computeDistributions({
      pools,
      tokens: [makeToken({ address: tokenA, symbol: "A" })],
    });

    expect(distribution.slices.map((slice) => slice.balance)).toEqual([
      90n,
      50n,
      10n,
    ]);
    expect(distribution.slices.map((slice) => slice.pool.address)).toEqual([
      poolTwo,
      poolThree,
      poolOne,
    ]);
  });

  it("merges the same token across chains into one distribution", function () {
    const pools = [
      makePool({
        address: poolOne,
        coins: [
          makeCoin({ address: vusdMainnet, balance: 40n, symbol: "VUSD" }),
        ],
      }),
      makePool({
        address: poolTwo,
        chainId: hemi.id,
        coins: [makeCoin({ address: vusdHemi, balance: 60n, symbol: "VUSD" })],
      }),
    ];
    const [distribution] = computeDistributions({
      pools,
      tokens: [makeToken({ address: vusdMainnet, symbol: "VUSD" })],
    });

    expect(distribution.totalBalance).toBe(100n);
    expect(distribution.slices.map((slice) => slice.pool.chainId)).toEqual([
      hemi.id,
      mainnet.id,
    ]);
  });

  it("leaves out a token that only shares the symbol", function () {
    const pools = [
      makePool({
        address: poolOne,
        coins: [
          makeCoin({ address: vusdMainnet, balance: 40n, symbol: "VUSD" }),
        ],
      }),
      makePool({
        address: poolTwo,
        chainId: hemi.id,
        coins: [makeCoin({ address: tokenC, balance: 60n, symbol: "VUSD" })],
      }),
    ];
    const [distribution] = computeDistributions({
      pools,
      tokens: [makeToken({ address: vusdMainnet, symbol: "VUSD" })],
    });

    expect(distribution.totalBalance).toBe(40n);
    expect(distribution.slices).toHaveLength(1);
    expect(distribution.slices[0].pool.address).toBe(poolOne);
  });

  it("assigns a zero share to every slice when total balance is zero", function () {
    const pools = [
      makePool({
        address: poolOne,
        coins: [makeCoin({ address: tokenA, balance: 0n })],
      }),
      makePool({
        address: poolTwo,
        coins: [makeCoin({ address: tokenA, balance: 0n })],
      }),
    ];
    const [distribution] = computeDistributions({
      pools,
      tokens: [makeToken({ address: tokenA, symbol: "A" })],
    });

    expect(distribution.totalBalance).toBe(0n);
    expect(distribution.slices).toHaveLength(2);
    expect(distribution.slices.every((slice) => slice.share === 0)).toBe(true);
  });

  it("considers only the pools that hold the given token", function () {
    const pools = [
      makePool({
        address: poolOne,
        coins: [
          makeCoin({ address: tokenA, balance: 100n }),
          makeCoin({ address: tokenB, balance: 200n }),
        ],
      }),
      makePool({
        address: poolTwo,
        coins: [makeCoin({ address: tokenC, balance: 999n })],
      }),
    ];
    const [distribution] = computeDistributions({
      pools,
      tokens: [makeToken({ address: tokenA, symbol: "A" })],
    });

    expect(distribution.totalBalance).toBe(100n);
    expect(distribution.slices).toHaveLength(1);
    expect(distribution.slices[0].pool.address).toBe(poolOne);
  });
});
