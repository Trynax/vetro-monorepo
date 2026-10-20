import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { combineQueryResults, sumUsdResults } from "./queries";

const result = <T = number>(state: Partial<UseQueryResult<T>>) =>
  ({
    data: undefined,
    isError: false,
    isLoading: false,
    isPending: false,
    ...state,
  }) as UseQueryResult<T>;

describe("combineQueryResults", function () {
  it("passes the data of every result to select, in order", function () {
    const select = vi.fn(
      ([amount, label, isOpen]: [number, string, boolean]) =>
        `${label}:${amount}:${isOpen}`,
    );

    expect(
      combineQueryResults({
        results: [
          result({ data: 10 }),
          result<string>({ data: "pool" }),
          result<boolean>({ data: false }),
        ],
        select,
      }),
    ).toEqual({
      data: "pool:10:false",
      isError: false,
      isLoading: false,
      isPending: false,
    });
    expect(select).toHaveBeenCalledExactlyOnceWith([10, "pool", false]);
  });

  it("does not call select while any result is missing data", function () {
    const select = vi.fn();

    expect(
      combineQueryResults({
        results: [
          result({ data: 10 }),
          result({ isLoading: true, isPending: true }),
        ],
        select,
      }),
    ).toEqual({
      data: undefined,
      isError: false,
      isLoading: true,
      isPending: true,
    });
    expect(select).not.toHaveBeenCalled();
  });

  it("reports pending but not loading while a disabled query waits", function () {
    const select = vi.fn(([amount]) => amount);

    expect(
      combineQueryResults({
        results: [result({ data: 10 }), result({ isPending: true })],
        select,
      }),
    ).toEqual({
      data: undefined,
      isError: false,
      isLoading: false,
      isPending: true,
    });

    expect(select).not.toHaveBeenCalled();
  });

  it("reports an error when any result failed", function () {
    const select = vi.fn(([amount]) => amount);
    expect(
      combineQueryResults({
        results: [result({ data: 10 }), result({ isError: true })],
        select,
      }),
    ).toEqual({
      data: undefined,
      isError: true,
      isLoading: false,
      isPending: false,
    });

    expect(select).not.toHaveBeenCalled();
  });

  it("stops loading and pending once any result failed", function () {
    const select = vi.fn(([amount]) => amount);

    expect(
      combineQueryResults({
        results: [
          result({ isError: true }),
          result({ isLoading: true, isPending: true }),
          result({ isPending: true }),
        ],
        select,
      }),
    ).toEqual({
      data: undefined,
      isError: true,
      isLoading: false,
      isPending: false,
    });
    expect(select).not.toHaveBeenCalled();
  });

  it("keeps the data when a result with data fails to refetch", function () {
    const select = vi.fn(([first, second]: [number, number]) => first * second);

    expect(
      combineQueryResults({
        results: [result({ data: 10 }), result({ data: 5, isError: true })],
        select,
      }),
    ).toEqual({ data: 50, isError: true, isLoading: false, isPending: false });
    expect(select).toHaveBeenCalledExactlyOnceWith([10, 5]);
  });

  it("treats null and falsy data as loaded", function () {
    const select = vi.fn((data: [null, number, boolean]) => data);

    expect(
      combineQueryResults({
        results: [
          result<null>({ data: null }),
          result({ data: 0 }),
          result<boolean>({ data: false }),
        ],
        select,
      }).data,
    ).toEqual([null, 0, false]);
    expect(select).toHaveBeenCalledExactlyOnceWith([null, 0, false]);
  });

  it("calls select with an empty list when there are no results", function () {
    const select = vi.fn((data: []) => data.length);

    expect(combineQueryResults({ results: [], select })).toEqual({
      data: 0,
      isError: false,
      isLoading: false,
      isPending: false,
    });
    expect(select).toHaveBeenCalledExactlyOnceWith([]);
  });
});

describe("sumUsdResults", function () {
  it("sums the data of every result", function () {
    expect(
      sumUsdResults([result({ data: 10 }), result({ data: 2.5 })]).data,
    ).toBe(12.5);
  });

  it("returns 0 for an empty list", function () {
    expect(sumUsdResults([]).data).toBe(0);
  });
});
