import { RenderFiatValue } from "components/base/fiatValue";
import { useStakedAmount } from "hooks/useStakedAmount";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useAccount } from "wagmi";

import { PoolInfoItem } from "./poolInfoItem";

type Props = {
  stakingVaultAddress: Address;
};

export function PoolInfoStakedAmount({ stakingVaultAddress }: Props) {
  const { t } = useTranslation();
  const { address: account } = useAccount();
  const { data, isError, isPending } = useStakedAmount(stakingVaultAddress);

  return (
    <PoolInfoItem
      data={data}
      isError={isError}
      isPending={!!account && isPending}
      label={t("pages.earn.pool-info.staked-amount")}
      render={({ peggedToken, stakedBalance }) => (
        <span className="text-xsm flex items-center gap-x-1 font-semibold text-gray-900">
          $
          <RenderFiatValue token={peggedToken} value={stakedBalance} />
        </span>
      )}
    />
  );
}
