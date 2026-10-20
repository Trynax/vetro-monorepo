import { SECONDS_PER_DAY, unixNowTimestamp } from "utils/date";

// TODO read the epoch bounds with epochPeriod(epochId)
// See https://github.com/vetro-protocol/vetro-monorepo/issues/646
export const fetchEpochPeriod = async function () {
  const endInDays = 37;
  const startInDays = 7;
  const now = unixNowTimestamp();

  return {
    end: BigInt(now + endInDays * SECONDS_PER_DAY),
    start: BigInt(now + startInDays * SECONDS_PER_DAY),
  };
};
