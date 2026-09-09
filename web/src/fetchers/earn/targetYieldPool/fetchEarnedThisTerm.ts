// TODO: implement real earned amount
// See https://github.com/vetro-protocol/vetro-monorepo/issues/646
const earnedUsdByEpochId: Record<string, number> = {
  "1": 10,
};

export const fetchEarnedThisTerm = async (epochId: bigint) =>
  earnedUsdByEpochId[epochId.toString()];
