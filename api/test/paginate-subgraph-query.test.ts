import { describe, expect, it, vi } from "vitest";

import * as graphql from "../src/graphql.ts";
import { paginateSubgraphQuery } from "../src/paginate-subgraph-query.ts";

vi.mock("../src/graphql.ts", () => ({
  runQuery: vi.fn(),
}));

const url = "https://subgraph.example/v1";
const query = "query ($first: Int!, $skip: Int!) { things { id } }";

type Thing = { id: string };

const buildPage = (count: number, startId = 0) =>
  Array.from({ length: count }, (_, i) => ({ id: (startId + i).toString() }));

const cursor = {
  getValue: (row: Thing) => row.id,
  variable: "start",
};

const paginate = (
  overrides: {
    cursor?: typeof cursor;
    maxSkip?: number;
    pageSize?: number;
    variables?: Record<string, unknown>;
  } = {},
) =>
  paginateSubgraphQuery<Thing>({ field: "things", query, url, ...overrides });

describe("paginate-subgraph-query/paginateSubgraphQuery", function () {
  it("returns [] and stops after one page when the first page is empty", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ things: [] });

    expect(await paginate()).toEqual([]);
    expect(graphql.runQuery).toHaveBeenCalledTimes(1);
  });

  it("fetches sequential pages, merging caller variables, until a short page", async function () {
    vi.mocked(graphql.runQuery)
      .mockResolvedValueOnce({ things: buildPage(100) })
      .mockResolvedValueOnce({ things: buildPage(37, 100) });

    const result = await paginate({ variables: { owner: "0xabc" } });

    expect(result).toHaveLength(137);
    expect(result[0].id).toBe("0");
    expect(result[136].id).toBe("136");
    expect(graphql.runQuery).toHaveBeenCalledTimes(2);
    expect(graphql.runQuery).toHaveBeenNthCalledWith(1, {
      query,
      url,
      variables: {
        first: 100,
        owner: "0xabc",
        skip: 0,
      },
    });
    expect(graphql.runQuery).toHaveBeenNthCalledWith(2, {
      query,
      url,
      variables: {
        first: 100,
        owner: "0xabc",
        skip: 100,
      },
    });
  });

  it("respects custom pageSize", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ things: buildPage(1) });

    const result = await paginate({ pageSize: 2 });

    expect(result).toHaveLength(1);
    expect(graphql.runQuery).toHaveBeenNthCalledWith(1, {
      query,
      url,
      variables: {
        first: 2,
        skip: 0,
      },
    });
  });

  it("throws when the response field is not an array", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      things: undefined,
    } as never);

    await expect(paginate()).rejects.toThrow(/Invalid subgraph response/);
  });

  it("throws when the skip cap is reached without a cursor", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ things: buildPage(100) });

    // maxSkip 200 + pageSize 100 → after fetching skip 200, the next skip (300)
    // exceeds the cap, so it throws instead of issuing an invalid skip.
    await expect(paginate({ maxSkip: 200 })).rejects.toThrow(
      /exceeded the maximum page offset/,
    );
    expect(graphql.runQuery).toHaveBeenCalledTimes(3);
  });

  it("advances the lower bound and resets skip at the cap, deduping the boundary", async function () {
    vi.mocked(graphql.runQuery)
      .mockResolvedValueOnce({ things: buildPage(100, 0) }) // skip 0
      .mockResolvedValueOnce({ things: buildPage(100, 100) }) // skip 100
      .mockResolvedValueOnce({ things: buildPage(100, 200) }) // skip 200 → reset, last id "299"
      .mockResolvedValueOnce({ things: buildPage(100, 299) }) // start "299", skip 0 → re-reads "299"
      .mockResolvedValueOnce({ things: buildPage(50, 399) }); // short page → done

    const result = await paginate({ cursor, maxSkip: 200 });

    // 300 from the first window, then a full page that re-reads "299" (deduped
    // to 99 new) and a final partial page of 50.
    expect(result).toHaveLength(449);
    expect(result.filter((row) => row.id === "299")).toHaveLength(1);
    // The page after the reset advances `start` to the last seen id and skips 0.
    expect(graphql.runQuery).toHaveBeenNthCalledWith(4, {
      query,
      url,
      variables: {
        first: 100,
        skip: 0,
        start: "299",
      },
    });
  });

  it("throws when too many rows share the cursor value to advance past the cap", async function () {
    // Every row has the same id, so the lower bound can never move forward.
    vi.mocked(graphql.runQuery).mockResolvedValue({
      things: Array.from({ length: 100 }, () => ({ id: "same" })),
    });

    await expect(paginate({ cursor, maxSkip: 200 })).rejects.toThrow(
      /cannot advance past cursor/,
    );
  });
});
