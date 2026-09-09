import type { Token } from "@vetro-protocol/core";
import { InfoCard } from "components/base/infoCard";
import { CardRow } from "components/earn/cardRow";
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
  <div className="border-b border-gray-200 xl:border-t">
    <CardRow
      left={
        <PositionCard
          shareToken={shareToken}
          stakingVaultAddress={stakingVaultAddress}
        />
      }
      right={<EarnedAmountCard stakingVaultAddress={stakingVaultAddress} />}
    />
  </div>
);
