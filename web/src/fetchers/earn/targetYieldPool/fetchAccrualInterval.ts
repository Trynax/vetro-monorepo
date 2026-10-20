import { SECONDS_PER_DAY, unixNowTimestamp } from "utils/date";

// TODO read the accrual bounds with accrualInterval(epochId)
// See https://github.com/vetro-protocol/vetro-monorepo/issues/646
export const fetchAccrualInterval = async function () {
  const endInDays = 37;
  const startInDays = 8;
  const now = unixNowTimestamp();

  return {
    end: BigInt(now + endInDays * SECONDS_PER_DAY),
    start: BigInt(now + startInDays * SECONDS_PER_DAY),
  };
};
