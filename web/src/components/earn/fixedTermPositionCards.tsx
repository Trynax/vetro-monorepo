import type { Token } from "@vetro-protocol/core";
import { InfoCard } from "components/base/infoCard";
import { CardRow } from "components/earn/cardRow";
import { PositionCard } from "components/earn/positionCard";
import { InfoIcon } from "components/icons/infoIcon";
import { RefreshIcon } from "components/icons/refreshIcon";
import { TrendingUpIcon } from "components/icons/trendingUpIcon";
import { Tooltip } from "components/tooltip";
import { useEarnedThisTerm } from "pages/earn/hooks/targetYieldPool/useEarnedThisTerm";
import { useRolloverStatus } from "pages/earn/hooks/targetYieldPool/useRolloverStatus";
import { useTranslation } from "react-i18next";
import { formatUsd } from "utils/currency";
import type { Address } from "viem";

type CardProps = {
  stakingVaultAddress: Address;
};

type Props = CardProps & {
  shareToken: Token;
};

const rolloverStatusKeys = {
  "auto-rolling": {
    description: "pages.earn.fixed-term.auto-rolling-description",
    title: "pages.earn.fixed-term.auto-rolling",
  },
} as const;

const EarnedThisTermCard = function ({ stakingVaultAddress }: CardProps) {
  const { t } = useTranslation();
  const { data: earnedUsd, isLoading } = useEarnedThisTerm(stakingVaultAddress);

  return (
    <InfoCard
      data={earnedUsd}
      icon={<TrendingUpIcon className="text-blue-500" />}
      isLoading={isLoading}
      label={
        <span className="flex items-center gap-x-1">
          {t("pages.earn.fixed-term.earned-this-term")}
          <Tooltip content={t("pages.earn.fixed-term.earned-this-term-info")}>
            <div className="*:size-3">
              <InfoIcon />
            </div>
          </Tooltip>
        </span>
      }
      render={formatUsd}
    />
  );
};

const RolloverStatusCard = function ({ stakingVaultAddress }: CardProps) {
  const { t } = useTranslation();
  const { data: status, isLoading } = useRolloverStatus(stakingVaultAddress);

  return (
    <InfoCard
      data={status}
      icon={<RefreshIcon className="text-blue-500" />}
      isLoading={isLoading}
      label={t("pages.earn.fixed-term.rollover-status")}
      render={(rolloverStatus) => t(rolloverStatusKeys[rolloverStatus].title)}
      subtitle={status ? t(rolloverStatusKeys[status].description) : undefined}
    />
  );
};

export const FixedTermPositionCards = ({
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
      right={<EarnedThisTermCard stakingVaultAddress={stakingVaultAddress} />}
    />
    <div className="xl:px-14 xl:*:border-0">
      <RolloverStatusCard stakingVaultAddress={stakingVaultAddress} />
    </div>
  </div>
);
