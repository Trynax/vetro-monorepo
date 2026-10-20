import { describe, expect, it } from "vitest";

import { isOpenToDeposits } from "./isOpenToDeposits";

const toUnixTimestamp = (date: string) => BigInt(Date.parse(date) / 1000);

const start = toUnixTimestamp("2026-10-01T00:00:00Z");
const end = toUnixTimestamp("2026-10-08T00:00:00Z");

const openState = {
  deposits: 100n,
  entryWindow: { end, start },
  isPaused: false,
  isShutdown: false,
  isTerminated: false,
  maxDeposits: 500n,
  now: toUnixTimestamp("2026-10-03T12:00:00Z"),
};

describe("isOpenToDeposits", function () {
  it("is open inside the entry window with capacity left", function () {
    expect(isOpenToDeposits(openState)).toBe(true);
  });

  it("is open exactly at the entry window start", function () {
    expect(isOpenToDeposits({ ...openState, now: start })).toBe(true);
  });

  it("is closed exactly at the entry window end", function () {
    expect(isOpenToDeposits({ ...openState, now: end })).toBe(false);
  });

  it("is closed before the entry window starts", function () {
    expect(isOpenToDeposits({ ...openState, now: start - 1n })).toBe(false);
  });

  it("is closed after the entry window ends, in limbo", function () {
    expect(
      isOpenToDeposits({
        ...openState,
        now: toUnixTimestamp("2026-11-15T00:00:00Z"),
      }),
    ).toBe(false);
  });

  it("is closed when there is no epoch yet", function () {
    expect(
      isOpenToDeposits({
        ...openState,
        deposits: 0n,
        entryWindow: { end: 0n, start: 0n },
        maxDeposits: 0n,
      }),
    ).toBe(false);
  });

  it("is closed when deposits equal the deposit cap", function () {
    expect(isOpenToDeposits({ ...openState, deposits: 500n })).toBe(false);
  });

  it("is open when deposits are one below the deposit cap", function () {
    expect(isOpenToDeposits({ ...openState, deposits: 499n })).toBe(true);
  });

  it("is closed when the vault is paused", function () {
    expect(isOpenToDeposits({ ...openState, isPaused: true })).toBe(false);
  });

  it("is closed when the vault is shut down", function () {
    expect(isOpenToDeposits({ ...openState, isShutdown: true })).toBe(false);
  });

  it("is closed when the vault is terminated", function () {
    expect(isOpenToDeposits({ ...openState, isTerminated: true })).toBe(false);
  });
});
