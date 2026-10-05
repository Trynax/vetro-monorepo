import { describe, expect, it } from "vitest";

import { getInputError } from "./getInputError";

const valid = {
  amount: 500n,
  balance: 1000n,
  maxRequest: 800n,
  nativeBalance: 100n,
};

describe("getInputError", function () {
  it("returns 'enter-amount' when the amount is 0", function () {
    expect(getInputError({ ...valid, amount: 0n })).toBe("enter-amount");
  });

  it("returns 'enter-amount' before any other error", function () {
    expect(
      getInputError({
        amount: 0n,
        balance: 0n,
        maxRequest: 0n,
        nativeBalance: 0n,
      }),
    ).toBe("enter-amount");
  });

  it("returns 'insufficient-balance' when the amount exceeds the balance", function () {
    expect(getInputError({ ...valid, amount: 1001n, maxRequest: 2000n })).toBe(
      "insufficient-balance",
    );
  });

  it("skips the balance check while the balance is unknown", function () {
    expect(getInputError({ ...valid, balance: undefined })).toBeUndefined();
  });

  it("returns 'insufficient-gas' when the native balance is 0", function () {
    expect(getInputError({ ...valid, nativeBalance: 0n })).toBe(
      "insufficient-gas",
    );
  });

  it("skips the gas check while the native balance is unknown", function () {
    expect(
      getInputError({ ...valid, nativeBalance: undefined }),
    ).toBeUndefined();
  });

  it("allows an amount equal to the max request", function () {
    expect(getInputError({ ...valid, amount: 800n })).toBeUndefined();
  });

  it("returns 'exceeds-max-request' when the amount exceeds the max request", function () {
    expect(getInputError({ ...valid, amount: 801n })).toBe(
      "exceeds-max-request",
    );
  });

  it("skips the max request check while it is unknown", function () {
    expect(
      getInputError({ ...valid, amount: 900n, maxRequest: undefined }),
    ).toBeUndefined();
  });

  it("returns 'insufficient-balance' before 'insufficient-gas'", function () {
    expect(getInputError({ ...valid, amount: 1001n, nativeBalance: 0n })).toBe(
      "insufficient-balance",
    );
  });

  it("returns 'insufficient-gas' before 'exceeds-max-request'", function () {
    expect(getInputError({ ...valid, amount: 900n, nativeBalance: 0n })).toBe(
      "insufficient-gas",
    );
  });

  it("returns undefined when every check passes", function () {
    expect(getInputError(valid)).toBeUndefined();
  });
});
