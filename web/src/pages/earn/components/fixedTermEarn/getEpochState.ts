// TODO: Implement — the real mapping still has to be confirmed against the
// entry and exit windows the vault exposes per epoch. Tests shall be added
// once we make the real mapping.
export function getEpochState({
  end,
  now,
  start,
}: {
  end: bigint;
  now: bigint;
  start: bigint;
}) {
  if (now < start) {
    return "open-to-deposits";
  }
  if (now < end) {
    return "open-to-exit";
  }
  return undefined;
}
