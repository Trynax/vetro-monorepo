import { InfoCard } from "components/base/infoCard";
import { CardRow } from "components/earn/cardRow";
import { DepositsOverCapacity } from "components/earn/depositsOverCapacity";
import { CalendarIcon } from "components/icons/calendarIcon";
import { PieChartIcon } from "components/icons/pieChartIcon";
import { PlayIcon } from "components/icons/playIcon";
import { SparklesIcon } from "components/icons/sparklesIcon";
import { useDeposits } from "pages/earn/hooks/targetYieldPool/useDeposits";
import { useTargetApy } from "pages/earn/hooks/targetYieldPool/useTargetApy";
import { useTerm } from "pages/earn/hooks/targetYieldPool/useTerm";
import { Trans, useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import { formatUsd } from "utils/currency";
import { SECONDS_PER_DAY, formatMediumDate } from "utils/date";
import { formatPercentage } from "utils/format";
import type { Address } from "viem";

type Props = {
  stakingVaultAddress: Address;
};

const termTimeZone = "UTC";

const TargetFixedApyCard = function ({ stakingVaultAddress }: Props) {
  const { i18n, t } = useTranslation();
  const targetApy = useTargetApy(stakingVaultAddress);
  const term = useTerm(stakingVaultAddress);

  function renderFixedUntil() {
    if (term.data) {
      return t("pages.earn.fixed-term.fixed-until", {
        date: formatMediumDate(
          Number(term.data.epochEnd),
          i18n.language,
          termTimeZone,
        ),
      });
    }
    return term.isLoading ? <Skeleton width={140} /> : undefined;
  }

  return (
    <InfoCard
      data={targetApy.data}
      icon={<SparklesIcon className="text-blue-500" />}
      isLoading={targetApy.isLoading}
      label={t("pages.earn.fixed-term.target-fixed-apy")}
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
  const { data: term, isLoading } = useTerm(stakingVaultAddress);

  return (
    <InfoCard
      data={
        term
          ? // Floored so a partial day never reads as a longer term than the
            // one the vault actually locks funds for.
            Math.floor(
              Number(term.epochEnd - term.epochStart) / SECONDS_PER_DAY,
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
  const { i18n, t } = useTranslation();
  const { data: term, isLoading } = useTerm(stakingVaultAddress);

  return (
    <InfoCard
      data={term?.epochEnd}
      icon={<CalendarIcon className="text-blue-500" />}
      isLoading={isLoading}
      label={t("pages.earn.fixed-term.term-end-date")}
      render={(epochEnd) =>
        formatMediumDate(Number(epochEnd), i18n.language, termTimeZone)
      }
    />
  );
};

export const FixedTermInfoCards = ({ stakingVaultAddress }: Props) => (
  <div className="border-b border-gray-200">
    <CardRow
      left={<TargetFixedApyCard stakingVaultAddress={stakingVaultAddress} />}
      right={<PoolCapacityCard stakingVaultAddress={stakingVaultAddress} />}
    />
    <CardRow
      left={<TermLengthCard stakingVaultAddress={stakingVaultAddress} />}
      right={<TermEndDateCard stakingVaultAddress={stakingVaultAddress} />}
    />
  </div>
);
