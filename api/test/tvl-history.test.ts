import { gateways } from "@vetro-protocol/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as graphql from "../src/graphql.ts";
import * as portalPrices from "../src/portal-prices.ts";
import { getTvlHistory } from "../src/tvl-history.ts";
import * as warmCache from "../src/warm-cache.ts";
import { readWarmedTask } from "../src/warm-cache.ts";
import { treasuryTask, tvlTask } from "../src/warm-tasks.ts";

vi.mock("../src/graphql.ts", () => ({
  runQuery: vi.fn(),
}));

vi.mock("../src/warm-cache.ts", async function (importOriginal) {
  const actual = await importOriginal<typeof warmCache>();
  return { ...actual, readWarmedTask: vi.fn() };
});

vi.mock("../src/portal-prices.ts", async function (importOriginal) {
  const actual = await importOriginal<typeof portalPrices>();
  return { ...actual, getPegBaseUsdRates: vi.fn() };
});

const url = "https://subgraph.example/v1";
const [vusdGateway, vetBtcGateway] = gateways;
const gatewayAddress = vusdGateway.address;
const btcGatewayAddress = vetBtcGateway.address;

const now = 1_708_000_000_000;
const secsPerDay = 86400;
const todayStart = Math.floor(now / 1000 / secsPerDay) * secsPerDay;

const fetchHistory = (period = "1w", address = gatewayAddress) =>
  getTvlHistory({
    c: {} as never,
    gatewayAddress: address,
    period,
    portalApiUrl: "https://portal.example",
    url,
  });

const lastCallVariables = <T>() =>
  vi.mocked(graphql.runQuery).mock.calls.at(-1)?.[0].variables as T | undefined;

const peggedTokenChecksummed = vusdGateway.peggedToken;
// The subgraph stores addresses lowercased, so the checksum is what the
// endpoint must produce.
const [tokenChecksummed] = vusdGateway.whitelistedTokens;
const tokenLowercase = tokenChecksummed.toLowerCase();

const tokenRow = {
  price: "99967390",
  tokenAddress: tokenLowercase,
  unitPrice: "100000000",
  withdrawable: "109581573710",
};

const historyRow = {
  timestamp: "1707782400",
  tokens: [tokenRow],
  totalSupply: "443736408129313428461563",
};

describe("tvl-history/getTvlHistory", function () {
  beforeEach(function () {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    // No live point unless a test opts in, so the assertions below describe
    // the subgraph series alone.
    vi.mocked(readWarmedTask).mockRejectedValue(new Error("not warmed"));
    vi.mocked(portalPrices.getPegBaseUsdRates).mockResolvedValue({
      at: () => 1,
      live: 1,
    });
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  it("returns an empty series when the subgraph returns no entries", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ tvlHistories: [] });

    expect(await fetchHistory()).toEqual([]);
  });

  it("converts the timestamp to ms and checksums every address", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      tvlHistories: [historyRow],
    });

    expect(await fetchHistory()).toEqual([
      {
        pegBaseUsdPrice: 1,
        peggedTokenAddress: peggedTokenChecksummed,
        timestamp: 1_707_782_400_000,
        tokens: [
          {
            price: "99967390",
            tokenAddress: tokenChecksummed,
            unitPrice: "100000000",
            withdrawable: "109581573710",
          },
        ],
        totalSupply: "443736408129313428461563",
      },
    ]);
  });

  it("keeps withdrawable and passes a null price through", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      tvlHistories: [
        {
          ...historyRow,
          tokens: [{ ...tokenRow, price: null, unitPrice: null }],
        },
      ],
    });

    const [point] = await fetchHistory();

    expect(point.tokens[0]).toEqual({
      price: null,
      tokenAddress: tokenChecksummed,
      unitPrice: null,
      withdrawable: "109581573710",
    });
  });

  it("asks for the gateway's peg-base rates over the period", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ tvlHistories: [] });

    await fetchHistory("1m", btcGatewayAddress);

    expect(portalPrices.getPegBaseUsdRates).toHaveBeenCalledWith({
      pegBaseSymbol: "BTC",
      period: "1m",
      portalApiUrl: "https://portal.example",
    });
  });

  it("values each record with the rate for its day", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      tvlHistories: [historyRow, { ...historyRow, timestamp: "1707868800" }],
    });
    vi.mocked(portalPrices.getPegBaseUsdRates).mockResolvedValue({
      at: (timestamp: number) =>
        timestamp === 1_707_782_400_000 ? 48000 : 52000,
      live: null,
    });

    const points = await fetchHistory("1w", btcGatewayAddress);

    expect(points.map((point) => point.pegBaseUsdPrice)).toEqual([
      48000, 52000,
    ]);
  });

  const warmLiveTvl = function () {
    vi.mocked(readWarmedTask).mockImplementation(async function (args) {
      if (args.task === tvlTask) return { minted: "500000000000000000000" };
      if (args.task === treasuryTask)
        return [
          {
            latestPrice: "99990000",
            priceDecimals: 8,
            tokenAddress: tokenLowercase,
            withdrawable: "200000000000",
          },
        ];
      throw new Error("unexpected task");
    } as never);
  };

  it("appends a live point for today, which the subgraph never covers", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      tvlHistories: [historyRow],
    });
    warmLiveTvl();

    const points = await fetchHistory();

    expect(points).toHaveLength(2);
    const live = points[1];
    // Snapped to the UTC day, matching every indexed record.
    expect(live.timestamp).toBe(1_707_955_200_000);
    expect(live.totalSupply).toBe("500000000000000000000");
    expect(live.tokens[0]).toEqual({
      price: "99990000",
      tokenAddress: tokenChecksummed,
      // 10 ** priceDecimals, matching the subgraph's unitPrice.
      unitPrice: "100000000",
      withdrawable: "200000000000",
    });
  });

  it("gives today's point the current rate, which the daily history lacks", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      tvlHistories: [historyRow],
    });
    vi.mocked(portalPrices.getPegBaseUsdRates).mockResolvedValue({
      at: () => 48000,
      live: 51000,
    });
    warmLiveTvl();

    const points = await fetchHistory("1w", btcGatewayAddress);

    expect(points.map((point) => point.pegBaseUsdPrice)).toEqual([
      48000, 51000,
    ]);
  });

  it("serves the subgraph series alone when the warmed read fails", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({
      tvlHistories: [historyRow],
    });

    const points = await fetchHistory();

    expect(points).toHaveLength(1);
  });

  it("queries the lowercased gateway and the period's UTC day start in one page", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ tvlHistories: [] });

    await fetchHistory("1m");

    expect(lastCallVariables()).toMatchObject({
      first: 1000,
      gateway: gatewayAddress.toLowerCase(),
      start: (todayStart - 30 * secsPerDay).toString(),
    });
  });

  it("clamps 1y to the rate history when the gateway needs a rate", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ tvlHistories: [] });

    await fetchHistory("1y", btcGatewayAddress);

    expect(lastCallVariables()).toMatchObject({
      start: (todayStart - 365 * secsPerDay).toString(),
    });
  });

  it("keeps the whole 1y window for a USD-pegged gateway", async function () {
    vi.mocked(graphql.runQuery).mockResolvedValue({ tvlHistories: [] });

    await fetchHistory("1y");

    expect(lastCallVariables()).toMatchObject({
      start: (todayStart - 366 * secsPerDay).toString(),
    });
  });
});
