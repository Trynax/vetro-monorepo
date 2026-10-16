// Concentrated-liquidity math for a Sushi / Uniswap-v3 price band. We need only
// these two pure-math functions, so they're copied from the Uniswap v3 SDK
//
// getAmount0Delta / getAmount1Delta below are the SDK's `roundUp = false` branch
// (the one `Position` uses), verbatim, with JSBI ops mapped to native bigint
// (`JSBI.leftShift` -> `<<`, `JSBI.divide` -> `/`).
//
// Pinned to @uniswap/v3-sdk@3.31.0 (commit ab3a18a):
//   SqrtPriceMath.getAmount0Delta / getAmount1Delta
//   https://github.com/Uniswap/sdks/blob/ab3a18a62922c0bda493130e53f2c8f6fad59558/sdks/v3-sdk/src/utils/sqrtPriceMath.ts#L25-L46
//   Position.amount0 / Position.amount1
//   https://github.com/Uniswap/sdks/blob/ab3a18a62922c0bda493130e53f2c8f6fad59558/sdks/v3-sdk/src/entities/position.ts#L68-L127

const Q96 = 2n ** 96n;

// Ticks index the price grid as 1.0001^tick.
const TICK_BASE = 1.0001;

// SqrtPriceMath.getAmount0Delta (roundUp = false), verbatim.
const getAmount0Delta = function (
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
) {
  const [lower, upper] =
    sqrtRatioAX96 > sqrtRatioBX96
      ? [sqrtRatioBX96, sqrtRatioAX96]
      : [sqrtRatioAX96, sqrtRatioBX96];
  const numerator1 = liquidity << 96n;
  const numerator2 = upper - lower;
  return (numerator1 * numerator2) / upper / lower;
};

// SqrtPriceMath.getAmount1Delta (roundUp = false), verbatim.
const getAmount1Delta = function (
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
) {
  const [lower, upper] =
    sqrtRatioAX96 > sqrtRatioBX96
      ? [sqrtRatioBX96, sqrtRatioAX96]
      : [sqrtRatioAX96, sqrtRatioBX96];
  return (liquidity * (upper - lower)) / Q96;
};

// A human price (token1 per token0) as a Q64.96 sqrt ratio. Not from the SDK:
// the SDK snaps bands to initialized ticks (needing its large TickMath table); we
// use the exact band price instead, so a float sqrt at the band boundary is fine.
const priceToSqrtRatioX96 = function ({
  decimals0,
  decimals1,
  price,
}: {
  decimals0: number;
  decimals1: number;
  price: number;
}) {
  const rawPrice = price * 10 ** (decimals1 - decimals0);
  return BigInt(Math.floor(Math.sqrt(rawPrice) * 2 ** 96));
};

const tickToSqrtRatioX96 = (tick: number) =>
  BigInt(Math.floor(Math.sqrt(TICK_BASE ** tick) * 2 ** 96));

export const priceToTick = function ({
  decimals0,
  decimals1,
  price,
}: {
  decimals0: number;
  decimals1: number;
  price: number;
}) {
  const rawPrice = price * 10 ** (decimals1 - decimals0);
  return Math.floor(Math.log(rawPrice) / Math.log(TICK_BASE));
};

export type TickLiquidity = { liquidityNet: bigint; tick: number };

export const computeBandAmounts = function ({
  currentTick,
  decimals0,
  decimals1,
  initializedTicks,
  liquidity,
  lowerPrice,
  sqrtPriceX96,
  upperPrice,
}: {
  currentTick: number;
  decimals0: number;
  decimals1: number;
  initializedTicks: TickLiquidity[];
  liquidity: bigint;
  lowerPrice: number;
  sqrtPriceX96: bigint;
  upperPrice: number;
}): { amount0: bigint; amount1: bigint } {
  const lowerTick = priceToTick({ decimals0, decimals1, price: lowerPrice });
  const upperTick = priceToTick({ decimals0, decimals1, price: upperPrice });

  const sliceTicks = initializedTicks
    .filter((entry) => entry.tick > lowerTick && entry.tick <= upperTick)
    .sort((a, b) => a.tick - b.tick);

  const bounds = [
    priceToSqrtRatioX96({ decimals0, decimals1, price: lowerPrice }),
    ...sliceTicks.map((entry) => tickToSqrtRatioX96(entry.tick)),
    priceToSqrtRatioX96({ decimals0, decimals1, price: upperPrice }),
  ];

  let sliceLiquidity = initializedTicks.reduce(function (total, entry) {
    if (entry.tick > lowerTick && entry.tick <= currentTick) {
      return total - entry.liquidityNet;
    }
    if (entry.tick > currentTick && entry.tick <= lowerTick) {
      return total + entry.liquidityNet;
    }
    return total;
  }, liquidity);

  let amount0 = 0n;
  let amount1 = 0n;
  bounds.slice(0, -1).forEach(function (lower, index) {
    if (index > 0) {
      sliceLiquidity += sliceTicks[index - 1].liquidityNet;
    }
    const upper = bounds[index + 1];
    if (sqrtPriceX96 <= lower) {
      // Slice above the price: all token0.
      amount0 += getAmount0Delta(lower, upper, sliceLiquidity);
    } else if (sqrtPriceX96 >= upper) {
      // Slice below the price: all token1.
      amount1 += getAmount1Delta(lower, upper, sliceLiquidity);
    } else {
      amount0 += getAmount0Delta(sqrtPriceX96, upper, sliceLiquidity);
      amount1 += getAmount1Delta(lower, sqrtPriceX96, sliceLiquidity);
    }
  });

  return { amount0, amount1 };
};
