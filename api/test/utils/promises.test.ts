import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fulfilledValues,
  throwIfAllRejected,
  valueOrEmpty,
  withTimeout,
} from "../../src/utils/promises.ts";

const fulfilled = <T>(value: T): PromiseFulfilledResult<T> => ({
  status: "fulfilled",
  value,
});

const rejected = (reason: unknown): PromiseRejectedResult => ({
  reason,
  status: "rejected",
});

describe("utils/fulfilledValues", function () {
  it("keeps the fulfilled values in order and drops the rejected ones", function () {
    expect(
      fulfilledValues([
        fulfilled(1),
        rejected(new Error("failed")),
        fulfilled(3),
      ]),
    ).toEqual([1, 3]);
  });

  it("returns an empty array when all results are rejected", function () {
    expect(fulfilledValues([rejected(new Error("failed"))])).toEqual([]);
  });
});

describe("utils/throwIfAllRejected", function () {
  it("does not throw when at least one result is fulfilled", function () {
    expect(() =>
      throwIfAllRejected([rejected(new Error("failed")), fulfilled(1)]),
    ).not.toThrow();
  });

  it("throws the reason of the first result when all results are rejected", function () {
    const first = new Error("first");

    expect(() =>
      throwIfAllRejected([rejected(first), rejected(new Error("second"))]),
    ).toThrow(first);
  });
});

describe("utils/valueOrEmpty", function () {
  it("returns the value of a fulfilled result", function () {
    expect(valueOrEmpty(fulfilled([1, 2]))).toEqual([1, 2]);
  });

  it("returns an empty array for a rejected result", function () {
    expect(valueOrEmpty(rejected(new Error("failed")))).toEqual([]);
  });
});

describe("utils/withTimeout", function () {
  beforeEach(function () {
    vi.useFakeTimers();
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  it("resolves with the value of a promise that settles in time", async function () {
    await expect(withTimeout(Promise.resolve("value"))).resolves.toBe("value");
  });

  it("rejects when the promise does not settle in time", async function () {
    const result = withTimeout(new Promise(() => undefined));
    vi.advanceTimersByTime(15_000);
    await expect(result).rejects.toThrow("Timed out after 15000 ms");
  });
});
