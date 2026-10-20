import fetchJson from "tiny-fetch-json";

type PriceHistory = { date: string; priceUsd: string }[];

type Prices = { prices: Record<string, string> };

const dayMs = 86_400_000;
// The portal keeps a year of daily prices, ending yesterday.
const historyDays = 365;

const toUtcDay = (timestamp: number) => Math.floor(timestamp / dayMs);

export const utcDayStart = (timestamp: number) => toUtcDay(timestamp) * dayMs;

// UTC day start, in seconds, of the oldest day a rate exists for. Callers clamp
// their window to it so they never ask for a day that has no rate. A USD peg
// needs no rate, so it has no bound.
export const oldestPricedDay = (pegBaseSymbol: string) =>
  pegBaseSymbol === "USD"
    ? 0
    : utcDayStart(Date.now() - historyDays * dayMs) / 1000;

async function getPricesByDay({
  pegBaseSymbol,
  period,
  portalApiUrl,
}: {
  pegBaseSymbol: string;
  period: string;
  portalApiUrl: string;
}) {
  const history = (await fetchJson(
    `${portalApiUrl}/price-history/${pegBaseSymbol}/${period}`,
  )) as PriceHistory;
  return new Map(
    history.map(({ date, priceUsd }) => [
      toUtcDay(Date.parse(date)),
      Number(priceUsd),
    ]),
  );
}

export const getUsdPrices = (portalApiUrl: string) =>
  fetchJson(`${portalApiUrl}/prices`, {
    signal: AbortSignal.timeout(5_000),
  }).then((body) => (body as Prices).prices);

async function getCurrentPrice({
  pegBaseSymbol,
  portalApiUrl,
}: {
  pegBaseSymbol: string;
  portalApiUrl: string;
}) {
  const prices = await getUsdPrices(portalApiUrl);
  const price = prices[pegBaseSymbol];
  return price === undefined ? null : Number(price);
}

export async function getPegBaseUsdRates({
  pegBaseSymbol,
  period,
  portalApiUrl,
}: {
  pegBaseSymbol: string;
  period: string;
  portalApiUrl: string;
}) {
  // If oracle returns USD, we don't need to call prices API
  if (pegBaseSymbol === "USD") {
    return { at: () => 1, live: 1 };
  }
  const onError = function (error: Error) {
    console.warn(
      `Failed to get ${pegBaseSymbol} USD prices: ${error.message}. Peg-unit rates will be null.`,
    );
    return null;
  };
  const [byDay, live] = await Promise.all([
    getPricesByDay({ pegBaseSymbol, period, portalApiUrl }).catch(onError),
    getCurrentPrice({ pegBaseSymbol, portalApiUrl }).catch(onError),
  ]);
  return {
    at: (timestamp: number) => byDay?.get(toUtcDay(timestamp)) ?? null,
    live,
  };
}
