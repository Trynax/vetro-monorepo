import type { Token } from "@vetro-protocol/core";
import { InfoCard } from "components/base/infoCard";
import { PositionCard } from "components/earn/positionCard";
import { TrendingUpIcon } from "components/icons/trendingUpIcon";
import { useEarnedAmountUsd } from "hooks/useEarnedAmountUsd";
import { useTranslation } from "react-i18next";
import { formatUsd } from "utils/currency";
import type { Address } from "viem";

type Props = {
  shareToken: Token;
  stakingVaultAddress: Address;
};

const EarnedAmountCard = function ({
  stakingVaultAddress,
}: {
  stakingVaultAddress: Address;
}) {
  const { t } = useTranslation();
  const { data: earnedUsd, isLoading } =
    useEarnedAmountUsd(stakingVaultAddress);

  return (
    <InfoCard
      data={earnedUsd}
      icon={<TrendingUpIcon className="text-blue-500" />}
      isLoading={isLoading}
      label={t("pages.earn.stats.earned-amount")}
      render={formatUsd}
    />
  );
};

export const VariableYieldPositionCards = ({
  shareToken,
  stakingVaultAddress,
}: Props) => (
  <div className="grid border-b border-gray-200 xl:grid-cols-2 xl:gap-x-14 xl:border-t">
    <div className="xl:pl-14 xl:*:border-0">
      <PositionCard
        shareToken={shareToken}
        stakingVaultAddress={stakingVaultAddress}
      />
    </div>
    <div className="xl:pr-14 xl:*:border-0">
      <EarnedAmountCard stakingVaultAddress={stakingVaultAddress} />
    </div>
  </div>
);
