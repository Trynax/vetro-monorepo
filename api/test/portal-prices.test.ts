import fetchJson from "tiny-fetch-json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPegBaseUsdRates, oldestPricedDay } from "../src/portal-prices.ts";

vi.mock("tiny-fetch-json", () => ({ default: vi.fn() }));

const portalApiUrl = "https://portal.example";

const history = [
  { date: "2025-09-13", priceUsd: "116104.31459072111" },
  { date: "2025-09-14", priceUsd: "115951.90996442267" },
];

const mockPortal = function ({
  current,
  daily,
}: {
  current: Record<string, string> | Error;
  daily: typeof history | Error;
}) {
  vi.mocked(fetchJson).mockImplementation(async function (url: string) {
    const isHistory = url.includes("/price-history/");
    const response = isHistory ? daily : current;
    if (response instanceof Error) throw response;
    return isHistory ? response : { prices: response };
  } as never);
};

const getRates = () =>
  getPegBaseUsdRates({ pegBaseSymbol: "BTC", period: "1w", portalApiUrl });

describe("portal-prices/getPegBaseUsdRates", function () {
  beforeEach(function () {
    vi.mocked(fetchJson).mockReset();
  });

  it("treats a USD peg as a rate of 1 without asking the portal", async function () {
    const rates = await getPegBaseUsdRates({
      pegBaseSymbol: "USD",
      period: "1w",
      portalApiUrl,
    });

    expect(rates.at(Date.UTC(2025, 8, 13))).toBe(1);
    expect(rates.live).toBe(1);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("matches each daily price to any time in its UTC day", async function () {
    mockPortal({ current: { BTC: "94514.79" }, daily: history });

    const rates = await getRates();

    expect(rates.at(Date.UTC(2025, 8, 13))).toBe(116104.31459072111);
    expect(rates.at(Date.UTC(2025, 8, 14, 18))).toBe(115951.90996442267);
    expect(rates.at(Date.UTC(2025, 8, 15))).toBeNull();
  });

  it("reads the live rate from the current prices", async function () {
    mockPortal({
      current: { BTC: "94514.79193898945", WBTC: "95797.8" },
      daily: history,
    });

    expect((await getRates()).live).toBe(94514.79193898945);
  });

  it("asks for the symbol's history over the period and the current prices", async function () {
    mockPortal({ current: {}, daily: [] });

    await getPegBaseUsdRates({
      pegBaseSymbol: "BTC",
      period: "3m",
      portalApiUrl,
    });

    const urls = vi.mocked(fetchJson).mock.calls.map(([url]) => url);
    expect(urls).toEqual(
      expect.arrayContaining([
        `${portalApiUrl}/price-history/BTC/3m`,
        `${portalApiUrl}/prices`,
      ]),
    );
  });

  it("gives a null live rate when the portal has no current price for the symbol", async function () {
    mockPortal({ current: {}, daily: history });

    expect((await getRates()).live).toBeNull();
  });

  it("keeps the live rate when the daily history fails", async function () {
    mockPortal({ current: { BTC: "94514.79" }, daily: new Error("400") });

    const rates = await getRates();

    expect(rates.at(Date.UTC(2025, 8, 13))).toBeNull();
    expect(rates.live).toBe(94514.79);
  });

  it("keeps the daily rates when the current price fails", async function () {
    mockPortal({ current: new Error("unreachable"), daily: history });

    const rates = await getRates();

    expect(rates.at(Date.UTC(2025, 8, 13))).toBe(116104.31459072111);
    expect(rates.live).toBeNull();
  });
});

describe("portal-prices/oldestPricedDay", function () {
  const now = Date.UTC(2026, 8, 15, 14, 30);

  beforeEach(function () {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  it("is the UTC day start a year of daily prices reaches back to", function () {
    expect(oldestPricedDay("BTC")).toBe(Date.UTC(2025, 8, 15) / 1000);
  });

  it("does not bound a USD peg", function () {
    expect(oldestPricedDay("USD")).toBe(0);
  });
});
