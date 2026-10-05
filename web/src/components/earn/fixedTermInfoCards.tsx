import { InfoCard } from "components/base/infoCard";
import { CardRow } from "components/earn/cardRow";
import { DepositsOverCapacity } from "components/earn/depositsOverCapacity";
import { CalendarIcon } from "components/icons/calendarIcon";
import { PieChartIcon } from "components/icons/pieChartIcon";
import { PlayIcon } from "components/icons/playIcon";
import { SparklesIcon } from "components/icons/sparklesIcon";
import { useDeposits } from "pages/earn/hooks/targetYieldPool/useDeposits";
import { useEpochEndDate } from "pages/earn/hooks/targetYieldPool/useEpochEndDate";
import { useEpochPeriod } from "pages/earn/hooks/targetYieldPool/useEpochPeriod";
import { useTargetApr } from "pages/earn/hooks/targetYieldPool/useTargetApr";
import { Trans, useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import { formatUsd } from "utils/currency";
import { SECONDS_PER_DAY } from "utils/date";
import { formatPercentage } from "utils/format";
import type { Address } from "viem";

type Props = {
  stakingVaultAddress: Address;
};

const TargetFixedAprCard = function ({ stakingVaultAddress }: Props) {
  const { t } = useTranslation();
  const targetApr = useTargetApr(stakingVaultAddress);
  const epochEndDate = useEpochEndDate(stakingVaultAddress);

  function renderFixedUntil() {
    if (epochEndDate.data) {
      return t("pages.earn.fixed-term.fixed-until", {
        date: epochEndDate.data,
      });
    }
    return epochEndDate.isLoading ? <Skeleton width={140} /> : undefined;
  }

  return (
    <InfoCard
      data={targetApr.data}
      icon={<SparklesIcon className="text-blue-500" />}
      isLoading={targetApr.isLoading}
      label={t("pages.earn.fixed-term.target-fixed-apr")}
      render={formatPercentage}
      subtitle={renderFixedUntil()}
    />
  );
};

const PoolCapacityCard = function ({ stakingVaultAddress }: Props) {
  const { t } = useTranslation();
  const { data: deposits, isLoading } = useDeposits(stakingVaultAddress);

  return (
    <InfoCard
      data={deposits}
      icon={<PieChartIcon className="text-blue-500" />}
      isLoading={isLoading}
      label={t("pages.earn.fixed-term.pool-capacity")}
      render={({ maxDepositsUsd, totalDepositsUsd }) => (
        <DepositsOverCapacity
          maxDepositsUsd={maxDepositsUsd}
          totalDepositsUsd={totalDepositsUsd}
        />
      )}
      subtitle={
        deposits ? (
          // Wrapped for better CSS styling.
          <span>
            <Trans
              components={{ amount: <span className="text-gray-900" /> }}
              i18nKey="pages.earn.fixed-term.capacity-remaining"
              values={{
                amount: formatUsd(
                  Math.max(
                    deposits.maxDepositsUsd - deposits.totalDepositsUsd,
                    0,
                  ),
                ),
              }}
            />
          </span>
        ) : undefined
      }
    />
  );
};

const TermLengthCard = function ({ stakingVaultAddress }: Props) {
  const { t } = useTranslation();
  const { data: epochPeriod, isLoading } = useEpochPeriod(stakingVaultAddress);

  return (
    <InfoCard
      data={
        epochPeriod
          ? // Floored so a partial day never reads as a longer term than the
            // one the vault actually locks funds for.
            Math.floor(
              Number(epochPeriod.end - epochPeriod.start) / SECONDS_PER_DAY,
            )
          : undefined
      }
      icon={<PlayIcon className="text-blue-500" />}
      isLoading={isLoading}
      label={t("pages.earn.fixed-term.term-length")}
      render={(days) =>
        t("pages.earn.fixed-term.term-length-days", { count: days })
      }
    />
  );
};

const TermEndDateCard = function ({ stakingVaultAddress }: Props) {
  const { t } = useTranslation();
  const { data: epochEndDate, isLoading } =
    useEpochEndDate(stakingVaultAddress);

  return (
    <InfoCard
      data={epochEndDate}
      icon={<CalendarIcon className="text-blue-500" />}
      isLoading={isLoading}
      label={t("pages.earn.fixed-term.term-end-date")}
      render={(date) => date}
    />
  );
};

export const FixedTermInfoCards = ({ stakingVaultAddress }: Props) => (
  <div className="border-b border-gray-200">
    <CardRow
      left={<TargetFixedAprCard stakingVaultAddress={stakingVaultAddress} />}
      right={<PoolCapacityCard stakingVaultAddress={stakingVaultAddress} />}
    />
    <CardRow
      left={<TermLengthCard stakingVaultAddress={stakingVaultAddress} />}
      right={<TermEndDateCard stakingVaultAddress={stakingVaultAddress} />}
    />
  </div>
);
