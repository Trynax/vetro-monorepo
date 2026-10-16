import type { Token } from "@vetro-protocol/core";
import { DisplayAmount } from "components/base/displayAmount";
import { TokenLogo } from "components/tokenLogo";
import { Tooltip } from "components/tooltip";
import { type PositionMetrics } from "hooks/borrow/usePositionReview";
import { useTranslation } from "react-i18next";
import { formatFiatNumber, formatPercentage } from "utils/format";

import { HealthFactor } from "./healthFactor";
import { QuestionIcon } from "./questionIcon";

type Props = {
  borrowApy: number;
  collateralToken: Token;
  current: PositionMetrics;
  lltv: number;
  loanToken: Token;
  updated: PositionMetrics | null;
};

const ArrowIcon = () => (
  <svg
    fill="none"
    height="16"
    viewBox="0 0 16 16"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      clipRule="evenodd"
      d="M8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15ZM7.29289 5.29289C7.68342 4.90237 8.31658 4.90237 8.70711 5.29289L11.2071 7.79289C11.5976 8.18342 11.5976 8.81658 11.2071 9.20711L8.70711 11.7071C8.31658 12.0976 7.68342 12.0976 7.29289 11.7071C6.90237 11.3166 6.90237 10.6834 7.29289 10.2929L8.58579 9H5.5C4.94772 9 4.5 8.55228 4.5 8C4.5 7.44772 4.94772 7 5.5 7H8.58579L7.29289 5.70711C6.90237 5.31658 6.90237 4.68342 7.29289 5.29289Z"
      fill="#99A1AF"
      fillRule="evenodd"
    />
  </svg>
);

const formatDailyCost = (value: number | null, perDay: string) =>
  value !== null ? `$${formatFiatNumber(value)} ${perDay}` : "-";

const formatLtvValue = (value: number | null) =>
  value !== null ? formatPercentage(value * 100) : "-";

const formatPrice = (value: number | null) =>
  value !== null ? `$${formatFiatNumber(value)}` : "-";

const PositionReviewRow = ({
  children,
  hasChanges,
  label,
  tooltip,
  updatedChildren,
}: {
  children: React.ReactNode;
  hasChanges: boolean;
  label: string;
  tooltip: string;
  updatedChildren: React.ReactNode;
}) => (
  <div className="flex items-center justify-between border-b border-gray-200 py-3.5 text-gray-900 last:border-b-0">
    <div className="flex h-5.5 items-center gap-1.5">
      <Tooltip content={tooltip}>
        <QuestionIcon />
      </Tooltip>
      <span className="text-b-medium">{label}</span>
    </div>
    <div className="flex items-center gap-3">
      <span className={`text-h4 w-26 ${hasChanges ? "opacity-50" : ""}`}>
        {children}
      </span>
      <ArrowIcon />
      <span className="text-h4 w-26 text-right">
        {hasChanges ? updatedChildren : "-"}
      </span>
    </div>
  </div>
);

export function PositionReview({
  borrowApy,
  collateralToken,
  current,
  lltv,
  loanToken,
  updated,
}: Props) {
  const { t } = useTranslation();

  const hasChanges = updated !== null;
  const perDay = t("pages.borrow.per-day");
  const aprText = t("pages.borrow.apr", {
    value: formatPercentage(borrowApy * 100),
  });

  const CollateralContainer = ({
    children,
  }: {
    children?: React.ReactNode;
  }) => (
    <span className="flex w-full items-center justify-end gap-2">
      <TokenLogo {...collateralToken} />
      {children}
    </span>
  );

  const LoanContainer = ({ children }: { children?: React.ReactNode }) => (
    <span className="flex w-full items-center justify-end gap-2">
      <TokenLogo {...loanToken} />
      {children}
    </span>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 py-3.5">
        <span className="text-b-medium text-gray-500">
          {t("pages.borrow.position-review")}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-b-medium w-26 text-gray-500">
            {t("pages.borrow.current")}
          </span>
          <span className="size-4" />
          <span className="text-b-medium w-26 text-right text-gray-500">
            {t("pages.borrow.updated")}
          </span>
        </div>
      </div>
      <PositionReviewRow
        hasChanges={hasChanges}
        label={t("pages.borrow.collateral")}
        tooltip={t("pages.borrow.collateral-tooltip")}
        updatedChildren={
          updated && (
            <span className="*:w-full">
              <DisplayAmount
                amount={updated.collateral}
                container={CollateralContainer}
                showSymbol={false}
                token={collateralToken}
              />
            </span>
          )
        }
      >
        <DisplayAmount
          amount={current.collateral}
          container={CollateralContainer}
          showSymbol={false}
          token={collateralToken}
        />
      </PositionReviewRow>
      <PositionReviewRow
        hasChanges={hasChanges}
        label={t("pages.borrow.loan")}
        tooltip={t("pages.borrow.loan-tooltip", { symbol: loanToken.symbol })}
        updatedChildren={
          updated && (
            <span className="*:w-full">
              <DisplayAmount
                amount={updated.borrowAssets}
                container={LoanContainer}
                showSymbol={false}
                token={loanToken}
              />
            </span>
          )
        }
      >
        <DisplayAmount
          amount={current.borrowAssets}
          container={LoanContainer}
          showSymbol={false}
          token={loanToken}
        />
      </PositionReviewRow>
      <PositionReviewRow
        hasChanges={hasChanges}
        label={t("pages.borrow.health-factor")}
        tooltip={t("pages.borrow.health-factor-tooltip")}
        updatedChildren={
          updated && (
            <HealthFactor
              lltv={lltv}
              ltv={updated.ltv !== null ? updated.ltv * 100 : null}
              value={updated.healthFactor}
            />
          )
        }
      >
        <HealthFactor
          lltv={lltv}
          ltv={current.ltv !== null ? current.ltv * 100 : null}
          value={current.healthFactor}
        />
      </PositionReviewRow>
      <PositionReviewRow
        hasChanges={hasChanges}
        label={t("pages.borrow.ltv")}
        tooltip={t("pages.borrow.ltv-tooltip", { symbol: loanToken.symbol })}
        updatedChildren={updated ? formatLtvValue(updated.ltv) : "-"}
      >
        {formatLtvValue(current.ltv)}
      </PositionReviewRow>
      <PositionReviewRow
        hasChanges={hasChanges}
        label={t("pages.borrow.liquidation-price")}
        tooltip={t("pages.borrow.liquidation-price-tooltip")}
        updatedChildren={updated ? formatPrice(updated.liquidationPrice) : "-"}
      >
        {formatPrice(current.liquidationPrice)}
      </PositionReviewRow>
      <PositionReviewRow
        hasChanges={hasChanges}
        label={t("pages.borrow.daily-interest-cost")}
        tooltip={t("pages.borrow.daily-interest-cost-tooltip")}
        updatedChildren={
          updated ? formatDailyCost(updated.dailyInterestCost, perDay) : "-"
        }
      >
        {formatDailyCost(current.dailyInterestCost, perDay)}
      </PositionReviewRow>
      <PositionReviewRow
        hasChanges={hasChanges}
        label={t("pages.borrow.effective-interest")}
        tooltip={t("pages.borrow.effective-interest-tooltip")}
        updatedChildren={aprText}
      >
        {aprText}
      </PositionReviewRow>
    </>
  );
}
