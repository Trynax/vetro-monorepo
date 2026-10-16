type TickSwap = { tick: number; timestamp: number; volumeUsd: number };

const isInBand = ({
  lowerTick,
  tick,
  upperTick,
}: {
  lowerTick: number;
  tick: number;
  upperTick: number;
}) => tick >= lowerTick && tick < upperTick;

const pathShare = function ({
  fromTick,
  lowerTick,
  toTick,
  upperTick,
}: {
  fromTick: number;
  lowerTick: number;
  toTick: number;
  upperTick: number;
}) {
  if (fromTick === toTick) {
    return isInBand({ lowerTick, tick: fromTick, upperTick }) ? 1 : 0;
  }
  const low = Math.min(fromTick, toTick);
  const high = Math.max(fromTick, toTick);
  const overlap = Math.min(high, upperTick) - Math.max(low, lowerTick);
  return Math.max(overlap, 0) / (high - low);
};

export const bandActivity = function ({
  lowerTick,
  nowSeconds,
  opening,
  swaps,
  upperTick,
}: {
  lowerTick: number;
  nowSeconds: number;
  opening: { tick: number; timestamp: number };
  swaps: TickSwap[];
  upperTick: number;
}) {
  let fromTick = opening.tick;
  let fromTime = opening.timestamp;
  let bandSeconds = 0;
  let bandVolume = 0;
  let totalVolume = 0;
  for (const swap of swaps) {
    if (isInBand({ lowerTick, tick: fromTick, upperTick })) {
      bandSeconds += swap.timestamp - fromTime;
    }
    bandVolume +=
      swap.volumeUsd *
      pathShare({ fromTick, lowerTick, toTick: swap.tick, upperTick });
    totalVolume += swap.volumeUsd;
    fromTick = swap.tick;
    fromTime = swap.timestamp;
  }
  if (isInBand({ lowerTick, tick: fromTick, upperTick })) {
    bandSeconds += nowSeconds - fromTime;
  }
  const windowSeconds = nowSeconds - opening.timestamp;
  const timeShare = windowSeconds > 0 ? bandSeconds / windowSeconds : 0;
  return {
    volumeShare: totalVolume > 0 ? bandVolume / totalVolume : timeShare,
  };
};
