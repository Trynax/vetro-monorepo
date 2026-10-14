import { useNowTickingPast } from "hooks/useNowTickingPast";
import { useTranslation } from "react-i18next";
import { unixNowTimestamp } from "utils/date";
import type { Address } from "viem";

import { useDepositState } from "../../hooks/targetYieldPool/useDepositState";
import { PoolInfoItem } from "../poolInfoBar/poolInfoItem";

import { isOpenToDeposits } from "./isOpenToDeposits";

type Props = {
  stakingVaultAddress: Address;
};

export function PoolTermState({ stakingVaultAddress }: Props) {
  const { t } = useTranslation();
  const {
    data: depositState,
    isError,
    isPending,
  } = useDepositState(stakingVaultAddress);

  useNowTickingPast(
    depositState
      ? [depositState.entryWindow.start, depositState.entryWindow.end]
      : undefined,
    (timestamp) => Number(timestamp),
  );

  function getLabel() {
    if (!depositState) {
      return undefined;
    }
    return isOpenToDeposits({
      ...depositState,
      now: BigInt(unixNowTimestamp()),
    })
      ? t("pages.earn.fixed-term.open-to-deposits")
      : t("pages.earn.fixed-term.deposits-closed");
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
