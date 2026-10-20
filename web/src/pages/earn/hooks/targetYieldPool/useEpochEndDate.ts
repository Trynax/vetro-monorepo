import { useTranslation } from "react-i18next";
import { formatMediumDate } from "utils/date";
import type { Address } from "viem";

import { useEpochPeriod } from "./useEpochPeriod";

const termTimeZone = "UTC";

export function useEpochEndDate(stakingVaultAddress: Address) {
  const { i18n } = useTranslation();
  const epochPeriod = useEpochPeriod(stakingVaultAddress);

  return {
    ...epochPeriod,
    data: epochPeriod.data
      ? formatMediumDate(
          Number(epochPeriod.data.end),
          i18n.language,
          termTimeZone,
        )
      : undefined,
  };
}
