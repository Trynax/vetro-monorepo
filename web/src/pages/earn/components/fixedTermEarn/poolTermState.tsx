import { useTranslation } from "react-i18next";
import { unixNowTimestamp } from "utils/date";
import type { Address } from "viem";

import { useEpochPeriod } from "../../hooks/targetYieldPool/useEpochPeriod";
import { PoolInfoItem } from "../poolInfoBar/poolInfoItem";

import { getEpochState } from "./getEpochState";

type Props = {
  stakingVaultAddress: Address;
};

export function PoolTermState({ stakingVaultAddress }: Props) {
  const { t } = useTranslation();
  const {
    data: epochPeriod,
    isError,
    isPending,
  } = useEpochPeriod(stakingVaultAddress);

  function getLabel() {
    if (!epochPeriod) {
      return undefined;
    }
    const state = getEpochState({
      ...epochPeriod,
      now: BigInt(unixNowTimestamp()),
    });
    if (state === "open-to-deposits") {
      return t("pages.earn.fixed-term.open-to-deposits");
    }
    if (state === "open-to-exit") {
      return t("pages.earn.fixed-term.open-to-exit");
    }
    return undefined;
  }

  return (
    <PoolInfoItem
      data={getLabel()}
      isError={isError}
      isPending={isPending}
      label={t("pages.earn.fixed-term.term-state")}
    />
  );
}
