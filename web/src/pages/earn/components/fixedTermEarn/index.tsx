import { targetYieldVaultAddresses } from "@vetro-protocol/target-yield-earn/addresses";
import { SectionHeader } from "components/base/sectionHeader";
import { useTranslation } from "react-i18next";

import { PoolInfoBar } from "./poolInfoBar";

export function FixedTermEarn() {
  const { t } = useTranslation();

  return (
    <>
      <SectionHeader title={t("pages.earn.fixed-term.title")} />
      {targetYieldVaultAddresses.map((stakingVaultAddress) => (
        <PoolInfoBar
          key={stakingVaultAddress}
          stakingVaultAddress={stakingVaultAddress}
        />
      ))}
    </>
  );
}
