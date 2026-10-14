import { useEffect, useState } from "react";
import { unixNowTimestamp } from "utils/date";

/**
 * Re-renders when the soonest future timestamp in `items` arrives, without
 * polling. `getFutureTimestamp` returns `undefined` to skip an item.
 * Returns the current unix-second clock.
 */
export function useNowTickingPast<T>(
  items: T[] | undefined,
  getFutureTimestamp: (item: T) => number | undefined,
): number {
  const [now, setNow] = useState(unixNowTimestamp);

  const next = items?.reduce<number | undefined>(function findNext(
    nearest,
    item,
  ) {
    const ts = getFutureTimestamp(item);
    if (ts === undefined || ts <= now) {
      return nearest;
    }
    if (nearest === undefined || ts < nearest) {
      return ts;
    }
    return nearest;
  }, undefined);

  useEffect(
    function scheduleNextTick() {
      if (next === undefined) {
        return undefined;
      }
      const delay = Math.max(0, (next - unixNowTimestamp()) * 1000);
      const timer = setTimeout(function tick() {
        setNow(unixNowTimestamp());
      }, delay);

      return () => clearTimeout(timer);
    },
    [next],
  );

  return now;
}
