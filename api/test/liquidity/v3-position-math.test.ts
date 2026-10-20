import { describe, expect, it } from "vitest";

import {
  computeBandAmounts,
  priceToTick,
  type TickLiquidity,
} from "../../src/liquidity/v3-position-math.ts";

const TWO_POW_96 = 2 ** 96;
const priceToSqrtX96 = ({
  decimals0,
  decimals1,
  price,
}: {
  decimals0: number;
  decimals1: number;
  price: number;
}) =>
  BigInt(
    Math.floor(Math.sqrt(price * 10 ** (decimals1 - decimals0)) * TWO_POW_96),
  );

const positionLiquidity = 10n ** 24n;
const narrowPool = {
  currentTick: 0,
  decimals0: 18,
  decimals1: 18,
  initializedTicks: [
    { liquidityNet: positionLiquidity, tick: -10 },
    { liquidityNet: -positionLiquidity, tick: 10 },
  ],
  liquidity: positionLiquidity,
  sqrtPriceX96: priceToSqrtX96({ decimals0: 18, decimals1: 18, price: 1 }),
};

const vusdUsdt = {
  currentTick: -276318,
  decimals0: 18,
  decimals1: 6,
  initializedTicks: [
    { liquidityNet: 15832704246747630n, tick: -278140 },
    { liquidityNet: 6302778627602425n, tick: -277320 },
    { liquidityNet: 130732401889084034n, tick: -276720 },
    { liquidityNet: 456968676566802726n, tick: -276420 },
    { liquidityNet: 946610042217059006n, tick: -276360 },
    { liquidityNet: 1997166337273480336n, tick: -276340 },
    { liquidityNet: 42575805005594985808n, tick: -276320 },
    { liquidityNet: -44572971342868466144n, tick: -276310 },
    { liquidityNet: -474186488246365959n, tick: -276300 },
    { liquidityNet: -472423553970693047n, tick: -276270 },
    { liquidityNet: -456968676566802726n, tick: -276220 },
    { liquidityNet: -130732401889084034n, tick: -275920 },
    { liquidityNet: -6302778627602425n, tick: -275370 },
    { liquidityNet: -14034507619047145n, tick: -274840 },
    { liquidityNet: -15832704246747630n, tick: -274500 },
  ],
  liquidity: 46144551162745885231n,
  sqrtPriceX96: 79254568996878735356728n,
};

const uniformPool = {
  currentTick: priceToTick({ decimals0: 18, decimals1: 6, price: 1 }),
  decimals0: 18,
  decimals1: 6,
  initializedTicks: [] as TickLiquidity[],
  liquidity: 131831110600160155n,
  sqrtPriceX96: priceToSqrtX96({ decimals0: 18, decimals1: 6, price: 1 }),
};

const atPrice = function <T extends { decimals0: number; decimals1: number }>(
  pool: T,
  price: number,
) {
  const { decimals0, decimals1 } = pool;
  return {
    ...pool,
    currentTick: priceToTick({ decimals0, decimals1, price }),
    sqrtPriceX96: priceToSqrtX96({ decimals0, decimals1, price }),
  };
};

describe("computeBandAmounts", function () {
  it("holds only token0 when the price is below the band", function () {
    const { amount0, amount1 } = computeBandAmounts({
      ...atPrice(uniformPool, 0.5),
      lowerPrice: 0.96,
      upperPrice: 1.04,
    });
    expect(amount1).toBe(0n);
    expect(amount0).toBeGreaterThan(0n);
  });

  it("holds only token1 when the price is above the band", function () {
    const { amount0, amount1 } = computeBandAmounts({
      ...atPrice(uniformPool, 2),
      lowerPrice: 0.96,
      upperPrice: 1.04,
    });
    expect(amount0).toBe(0n);
    expect(amount1).toBeGreaterThan(0n);
  });

  it("splits into both tokens when the price is inside the band", function () {
    const { amount0, amount1 } = computeBandAmounts({
      ...uniformPool,
      lowerPrice: 0.96,
      upperPrice: 1.04,
    });
    expect(amount0).toBeGreaterThan(0n);
    expect(amount1).toBeGreaterThan(0n);
    const vusd = Number(amount0) / 1e18;
    const usdt = Number(amount1) / 1e6;
    expect(vusd).toBeGreaterThan(2500);
    expect(vusd).toBeLessThan(2600);
    expect(usdt).toBeGreaterThan(2600);
    expect(usdt).toBeLessThan(2700);
  });

  it("holds more of each token in a wider band", function () {
    const narrow = computeBandAmounts({
      ...uniformPool,
      lowerPrice: 0.98,
      upperPrice: 1.02,
    });
    const wide = computeBandAmounts({
      ...uniformPool,
      lowerPrice: 0.9,
      upperPrice: 1.1,
    });
    expect(wide.amount0).toBeGreaterThan(narrow.amount0);
    expect(wide.amount1).toBeGreaterThan(narrow.amount1);
  });

  it("splits evenly for a price-symmetric band at $1 (equal decimals)", function () {
    const { amount0, amount1 } = computeBandAmounts({
      ...atPrice({ ...uniformPool, decimals1: 18 }, 1),
      liquidity: 10n ** 24n,
      lowerPrice: 0.5,
      upperPrice: 2,
    });
    const diff = Number(
      amount0 > amount1 ? amount0 - amount1 : amount1 - amount0,
    );
    expect(diff / Number(amount0)).toBeLessThan(1e-4);
  });

  it("counts concentrated liquidity only where it is actually placed", function () {
    const { amount0, amount1 } = computeBandAmounts({
      ...narrowPool,
      lowerPrice: 0.5,
      upperPrice: 2,
    });
    const expected = Number(positionLiquidity) * (1 - 1 / 1.0001 ** 5);
    expect(Number(amount0) / expected).toBeCloseTo(1, 3);
    expect(Number(amount1) / expected).toBeCloseTo(1, 3);
  });

  it("stops growing once the band covers all the liquidity", function () {
    const band = computeBandAmounts({
      ...narrowPool,
      lowerPrice: 0.5,
      upperPrice: 2,
    });
    const wider = computeBandAmounts({
      ...narrowPool,
      lowerPrice: 0.1,
      upperPrice: 10,
    });
    expect(wider.amount0).toBe(band.amount0);
    expect(wider.amount1).toBe(band.amount1);
  });

  it("keeps a band within the pool's real balances", function () {
    const { amount0, amount1 } = computeBandAmounts({
      ...vusdUsdt,
      lowerPrice: 0.96,
      upperPrice: 1.04,
    });
    const vusd = Number(amount0) / 1e18;
    const usdt = Number(amount1) / 1e6;
    expect(vusd).toBeGreaterThan(23_000);
    expect(vusd).toBeLessThan(26_484);
    expect(usdt).toBeGreaterThan(15_000);
    expect(usdt).toBeLessThan(31_660);
  });

  it("ignores initialized ticks outside the band", function () {
    const band = { lowerPrice: 0.96, upperPrice: 1.04 };
    const withDistantTicks = computeBandAmounts({
      ...vusdUsdt,
      ...band,
      initializedTicks: [
        { liquidityNet: 10n ** 30n, tick: -400_000 },
        ...vusdUsdt.initializedTicks,
        { liquidityNet: -(10n ** 30n), tick: -100_000 },
      ],
    });
    expect(withDistantTicks).toEqual(
      computeBandAmounts({ ...vusdUsdt, ...band }),
    );
  });

  it("un-crosses ticks below the band when the price sits above it", function () {
    const above = computeBandAmounts({
      ...vusdUsdt,
      lowerPrice: 0.96,
      upperPrice: 0.99,
    });
    expect(above.amount0).toBe(0n);
    expect(Number(above.amount1) / 1e6).toBeGreaterThan(2000);
    expect(Number(above.amount1) / 1e6).toBeLessThan(3000);
  });
});
