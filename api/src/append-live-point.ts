const DAY_MS = 86_400_000;

const sameUtcDay = (a: number, b: number) =>
  Math.floor(a / DAY_MS) === Math.floor(b / DAY_MS);

/**
 * Append a live on-chain reading to a daily subgraph series while keeping at most
 * one point per UTC day.
 */
export function appendLivePoint<T extends { timestamp: number }>({
  getValue,
  history,
  livePoint,
}: {
  getValue: (point: T) => number | string;
  history: T[];
  livePoint: T | null;
}) {
  if (!livePoint) {
    return history;
  }
  const last = history[history.length - 1];
  if (last && sameUtcDay(last.timestamp, livePoint.timestamp)) {
    return getValue(last) === getValue(livePoint)
      ? history
      : [...history.slice(0, -1), livePoint];
  }
  return [...history, livePoint];
}
