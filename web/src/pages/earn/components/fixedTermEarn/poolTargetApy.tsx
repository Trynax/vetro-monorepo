import { useTranslation } from "react-i18next";
import type { Address } from "viem";

import { useTargetApr } from "../../hooks/targetYieldPool/useTargetApr";
import { PoolInfoItem } from "../poolInfoBar/poolInfoItem";

type Props = {
  stakingVaultAddress: Address;
};

export function PoolTargetApy({ stakingVaultAddress }: Props) {
  const { t } = useTranslation();
  const {
    data: targetApr,
    isError,
    isPending,
  } = useTargetApr(stakingVaultAddress);

  return (
    <PoolInfoItem
      data={targetApr !== undefined ? `${targetApr.toFixed(2)}%` : undefined}
      isError={isError}
      isPending={isPending}
      label={t("pages.earn.fixed-term.target-fixed-apr")}
    />
  );
}
