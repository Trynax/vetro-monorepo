import { describe, expect, it } from "vitest";

import { bandActivity } from "./bandActivity";

const band = {
  lowerTick: -100,
  nowSeconds: 1000,
  upperTick: 100,
};

const openingAt = (tick: number) => ({ tick, timestamp: 0 });

describe("bandActivity", function () {
  it("gives the band everything when the price stays inside it", function () {
    expect(
      bandActivity({
        ...band,
        opening: openingAt(0),
        swaps: [
          { tick: 10, timestamp: 200, volumeUsd: 50 },
          { tick: -10, timestamp: 600, volumeUsd: 150 },
        ],
      }),
    ).toEqual({ volumeShare: 1 });
  });

  it("gives the band nothing when the price stays outside it", function () {
    expect(
      bandActivity({
        ...band,
        opening: openingAt(200),
        swaps: [{ tick: 300, timestamp: 500, volumeUsd: 100 }],
      }),
    ).toEqual({ volumeShare: 0 });
  });

  it("splits a swap that crosses a band edge by its tick path", function () {
    expect(
      bandActivity({
        ...band,
        opening: openingAt(50),
        swaps: [{ tick: 150, timestamp: 400, volumeUsd: 100 }],
      }),
    ).toEqual({ volumeShare: 0.5 });
  });

  it("counts a swap that jumps over the whole band", function () {
    expect(
      bandActivity({
        ...band,
        opening: openingAt(-300),
        swaps: [{ tick: 300, timestamp: 500, volumeUsd: 60 }],
      }).volumeShare,
    ).toBeCloseTo(1 / 3);
  });

  it("treats the upper tick as outside the band", function () {
    expect(
      bandActivity({
        ...band,
        opening: openingAt(100),
        swaps: [{ tick: 100, timestamp: 500, volumeUsd: 10 }],
      }),
    ).toEqual({ volumeShare: 0 });
  });

  it("falls back to the time share when nothing traded", function () {
    expect(
      bandActivity({
        ...band,
        opening: openingAt(0),
        swaps: [
          { tick: 500, timestamp: 250, volumeUsd: 0 },
          { tick: 0, timestamp: 750, volumeUsd: 0 },
        ],
      }).volumeShare,
    ).toBe(0.5);
  });

  it("measures the time fallback from the opening, not the window start", function () {
    expect(
      bandActivity({
        ...band,
        opening: { tick: 0, timestamp: 600 },
        swaps: [{ tick: 500, timestamp: 800, volumeUsd: 0 }],
      }),
    ).toEqual({ volumeShare: 0.5 });
  });
});
