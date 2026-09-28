export const chartPeriods = ["1w", "1m", "3m", "1y"] as const;
export type ChartPeriod = (typeof chartPeriods)[number];

export const periodLabelKeys = {
  "1m": "common.charts.period-1-month",
  "1w": "common.charts.period-1-week",
  "1y": "common.charts.period-1-year",
  "3m": "common.charts.period-3-month",
} as const;

const periodDurations: Record<ChartPeriod, number> = {
  "1m": 30 * 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
  "3m": 90 * 24 * 60 * 60 * 1000,
};

export const getPlaceholderXTicks = function (period: ChartPeriod) {
  const now = Date.now();
  const duration = periodDurations[period];
  return Array.from(
    { length: 4 },
    (_, i) => now - duration + (i * duration) / 3,
  );
};
