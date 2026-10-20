import type { Address, Client } from "viem";
import { getBlockNumber, multicall } from "viem/actions";

import { type TickLiquidity } from "./v3-position-math.ts";

const poolAbi = [
  {
    inputs: [],
    name: "liquidity",
    outputs: [{ name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "slot0",
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "wordPosition", type: "int16" }],
    name: "tickBitmap",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "tickSpacing",
    outputs: [{ name: "", type: "int24" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tick", type: "int24" }],
    name: "ticks",
    outputs: [
      { name: "liquidityGross", type: "uint128" },
      { name: "liquidityNet", type: "int128" },
      { name: "feeGrowthOutside0X128", type: "uint256" },
      { name: "feeGrowthOutside1X128", type: "uint256" },
      { name: "tickCumulativeOutside", type: "int56" },
      { name: "secondsPerLiquidityOutsideX128", type: "uint160" },
      { name: "secondsOutside", type: "uint32" },
      { name: "initialized", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const BITS_PER_WORD = 256;

// A pool records which ticks are initialized in 256-bit words, indexed by the
// tick divided by the pool's spacing.
const wordPosition = ({ spacing, tick }: { spacing: number; tick: number }) =>
  Math.floor(Math.floor(tick / spacing) / BITS_PER_WORD);

const setBits = function (bitmap: bigint) {
  const bits: number[] = [];
  for (let bit = 0; bit < BITS_PER_WORD; bit++) {
    if (((bitmap >> BigInt(bit)) & 1n) === 1n) {
      bits.push(bit);
    }
  }
  return bits;
};

export const fetchV3PoolState = async function ({
  client,
  lowerTick,
  poolAddress,
  upperTick,
}: {
  client: Client;
  lowerTick: number;
  poolAddress: Address;
  upperTick: number;
}) {
  const blockNumber = await getBlockNumber(client);

  const [[sqrtPriceX96, currentTick], liquidity, spacing] = await multicall(
    client,
    {
      allowFailure: false,
      blockNumber,
      contracts: [
        { abi: poolAbi, address: poolAddress, functionName: "slot0" },
        { abi: poolAbi, address: poolAddress, functionName: "liquidity" },
        { abi: poolAbi, address: poolAddress, functionName: "tickSpacing" },
      ],
    },
  );

  const firstTick = Math.min(lowerTick, currentTick);
  const lastTick = Math.max(upperTick, currentTick);
  const firstWord = wordPosition({ spacing, tick: firstTick });
  const lastWord = wordPosition({ spacing, tick: lastTick });
  const words = Array.from(
    { length: lastWord - firstWord + 1 },
    (_, index) => firstWord + index,
  );

  const bitmaps = await multicall(client, {
    allowFailure: false,
    batchSize: 0,
    blockNumber,
    contracts: words.map((word) => ({
      abi: poolAbi,
      address: poolAddress,
      args: [word] as const,
      functionName: "tickBitmap" as const,
    })),
  });

  const ticks = words
    .flatMap((word, index) =>
      setBits(bitmaps[index]).map(
        (bit) => (word * BITS_PER_WORD + bit) * spacing,
      ),
    )
    .filter((tick) => tick >= firstTick && tick <= lastTick);

  const tickData = await multicall(client, {
    allowFailure: false,
    batchSize: 0,
    blockNumber,
    contracts: ticks.map((tick) => ({
      abi: poolAbi,
      address: poolAddress,
      args: [tick] as const,
      functionName: "ticks" as const,
    })),
  });

  return {
    currentTick,
    initializedTicks: ticks.map(
      (tick, index): TickLiquidity => ({
        liquidityNet: tickData[index][1],
        tick,
      }),
    ),
    liquidity,
    sqrtPriceX96,
  };
};
