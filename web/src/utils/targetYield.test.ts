import { parseUnits } from "viem";
import { describe, expect, it } from "vitest";

import { getEstimatedYield } from "./targetYield";

const day = 86_400n;
const accrualStart = 1_800_000_000n;
const rate = parseUnits("0.085", 18);

describe("getEstimatedYield", function () {
  it("pays the full rate over one 365-day year", function () {
    expect(
      getEstimatedYield({
        accrualEnd: accrualStart + 365n * day,
        accrualStart,
        amount: parseUnits("1000", 18),
        now: accrualStart - day,
        rate,
      }),
    ).toBe(parseUnits("85", 18));
  });

  it("prorates the rate linearly over a 30-day accrual interval", function () {
    // 100 * 0.085 * 30 / 365 = 0.698630136986301369863..., floored to wei
    expect(
      getEstimatedYield({
        accrualEnd: accrualStart + 30n * day,
        accrualStart,
        amount: parseUnits("100", 18),
        now: accrualStart - 7n * day,
        rate,
      }),
    ).toBe(698_630_136_986_301_369n);
  });

  it("only counts the time left when the accrual interval already started", function () {
    expect(
      getEstimatedYield({
        accrualEnd: accrualStart + 365n * day,
        accrualStart,
        amount: parseUnits("1000", 18),
        now: accrualStart + 73n * day,
        rate,
      }),
    ).toBe(parseUnits("68", 18));
  });

  it("returns 0 at maturity", function () {
    expect(
      getEstimatedYield({
        accrualEnd: accrualStart + 30n * day,
        accrualStart,
        amount: parseUnits("100", 18),
        now: accrualStart + 30n * day,
        rate,
      }),
    ).toBe(0n);
  });

  it("returns 0 after maturity", function () {
    expect(
      getEstimatedYield({
        accrualEnd: accrualStart + 30n * day,
        accrualStart,
        amount: parseUnits("100", 18),
        now: accrualStart + 31n * day,
        rate,
      }),
    ).toBe(0n);
  });

  it("returns 0 for a zero amount", function () {
    expect(
      getEstimatedYield({
        accrualEnd: accrualStart + 30n * day,
        accrualStart,
        amount: 0n,
        now: accrualStart,
        rate,
      }),
    ).toBe(0n);
  });

  it("returns 0 for a zero rate", function () {
    expect(
      getEstimatedYield({
        accrualEnd: accrualStart + 30n * day,
        accrualStart,
        amount: parseUnits("100", 18),
        now: accrualStart,
        rate: 0n,
      }),
    ).toBe(0n);
  });

  it("rounds down like the contract", function () {
    // 1 wei * 0.085 * 1 / 365 is below 1 wei
    expect(
      getEstimatedYield({
        accrualEnd: accrualStart + day,
        accrualStart,
        amount: 1n,
        now: accrualStart,
        rate,
      }),
    ).toBe(0n);
  });
});
