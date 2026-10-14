// TODO: Map the exit window the vault exposes per epoch. A future PR will
// implement it.
export function getEpochState({
  end,
  now,
  start,
}: {
  end: bigint;
  now: bigint;
  start: bigint;
}) {
  if (now >= start && now < end) {
    return "open-to-exit";
  }
  return undefined;
}
