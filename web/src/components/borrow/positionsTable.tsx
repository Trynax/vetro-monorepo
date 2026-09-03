import { SectionHeader } from "components/base/sectionHeader";
import { Table, type TableColumnDef } from "components/base/table";
import { Header } from "components/base/table/header";
import { useBorrowAction } from "hooks/borrow/useBorrowAction";
import { type MarketData, useMarketsData } from "hooks/borrow/useMarketsData";
import {
  type PositionData,
  usePositionsData,
} from "hooks/borrow/usePositionsData";
import { usePrices } from "hooks/usePrices";
import { useScrollToHash } from "hooks/useScrollToHash";
import { lazy, Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { isPositionAtRisk } from "utils/borrowPosition";
import {
  calculateDailyInterestCost,
  formatHealthFactor,
  formatLtvAsPercentage,
} from "utils/borrowReview";
import { formatFiatNumber, formatPercentage } from "utils/format";
import { getTokenPrice } from "utils/token";
import { type Hash, formatUnits } from "viem";
import { useAccount } from "wagmi";

import { HealthFactor, HealthFactorBar } from "./healthFactor";
import { LiquidationPriceCell } from "./liquidationPriceCell";
import { LiquidationWarning } from "./liquidationWarning";
import { ManageButton } from "./manageButton";
import {
  PositionsDisconnectedState,
  PositionsEmptyState,
} from "./positionsEmptyState";
import { TokenValueCell } from "./tokenValueCell";

const BorrowMoreDrawerForm = lazy(() =>
  import("./borrowMoreDrawerForm").then((m) => ({
    default: m.BorrowMoreDrawerForm,
  })),
);

const SupplyCollateralDrawerForm = lazy(() =>
  import("./supplyCollateralDrawerForm").then((m) => ({
    default: m.SupplyCollateralDrawerForm,
  })),
);

const SupplyCollateralAndBorrowDrawerForm = lazy(() =>
  import("./supplyCollateralAndBorrowDrawerForm").then((m) => ({
    default: m.SupplyCollateralAndBorrowDrawerForm,
  })),
);

const RepayLoanDrawerForm = lazy(() =>
  import("./repayLoanDrawerForm").then((m) => ({
    default: m.RepayLoanDrawerForm,
  })),
);

const WithdrawCollateralDrawerForm = lazy(() =>
  import("./withdrawCollateralDrawerForm").then((m) => ({
    default: m.WithdrawCollateralDrawerForm,
  })),
);

type PositionRow = MarketData & PositionData;

type Props = {
  marketIds: Hash[];
};

export function PositionsTable({ marketIds }: Props) {
  const { address } = useAccount();
  const ref = useScrollToHash("borrow-positions");
  const { t } = useTranslation();
  const { data: marketsData, isLoading: isMarketsLoading } =
    useMarketsData(marketIds);
  const { data: positionsData, isLoading: isPositionsLoading } =
    usePositionsData(marketIds);
  const { data: prices } = usePrices();
  const [{ borrowAction, marketId: actionMarketId }, setBorrowAction] =
    useBorrowAction();

  const clearBorrowAction = () =>
    setBorrowAction({ borrowAction: null, marketId: null });

  const activeMarket =
    actionMarketId !== null
      ? marketsData.find((m) => m.marketId === actionMarketId)
      : undefined;

  const data = useMemo(
    (): PositionRow[] =>
      positionsData.reduce<PositionRow[]>(function (acc, position) {
        const market = marketsData.find(
          (m) => m.marketId === position.marketId,
        );
        if (market) {
          acc.push({ ...market, ...position });
        }
        return acc;
      }, []),
    [marketsData, positionsData],
  );

  const columns = useMemo(
    (): TableColumnDef<PositionRow>[] => [
      {
        cell: ({ row }) => (
          <TokenValueCell
            align="left"
            token={row.original.collateralToken}
            value={row.original.collateral}
          />
        ),
        header: () => <Header text={t("pages.borrow.collateral")} />,
        id: "collateral",
        meta: { className: "justify-start grow", width: "160px" },
      },
      {
        cell: ({ row }) => (
          <TokenValueCell
            align="left"
            token={row.original.loanToken}
            value={row.original.borrowAssets}
          />
        ),
        header: () => <Header text={t("pages.borrow.loan")} />,
        id: "loan",
        meta: { className: "justify-start mx-3", width: "120px" },
      },
      {
        cell({ row }) {
          const lltv = formatLtvAsPercentage(row.original.lltv);
          const ltv =
            row.original.ltv !== null && row.original.ltv !== undefined
              ? formatLtvAsPercentage(row.original.ltv)
              : null;
          const value = formatHealthFactor(row.original.healthFactor);
          return (
            <div className="flex flex-col gap-y-1">
              <span className="text-b-medium">
                <HealthFactor lltv={lltv} ltv={ltv} value={value} />
              </span>
              <HealthFactorBar lltv={lltv} ltv={ltv} />
            </div>
          );
        },
        header: () => <Header text={t("pages.borrow.health-factor")} />,
        id: "health-factor",
        meta: { className: "justify-start mx-3", width: "96px" },
      },
      {
        cell: ({ row }) => (
          <LiquidationPriceCell {...row.original} prices={prices} />
        ),
        header: () => <Header text={t("pages.borrow.liquidation-price")} />,
        id: "liq-price",
        meta: { className: "justify-start mx-3", width: "120px" },
      },
      {
        cell: ({ row }) => (
          <div className="flex flex-col items-center">
            <span className="text-b-medium text-gray-900">
              {row.original.ltv !== null && row.original.ltv !== undefined
                ? `${formatPercentage(formatLtvAsPercentage(row.original.ltv))}`
                : "-"}
            </span>
            <span className="text-caption text-gray-500 *:w-full">
              {t("pages.borrow.max-lltv", {
                value: formatPercentage(
                  formatLtvAsPercentage(row.original.lltv),
                ),
              })}
            </span>
          </div>
        ),
        header: () => <Header align="center" text={t("pages.borrow.ltv")} />,
        id: "ltv",
        meta: { className: "justify-center mx-3", width: "64px" },
      },
      {
        cell({ row }) {
          const borrowAmount = Number(
            formatUnits(
              row.original.borrowAssets,
              row.original.loanToken.decimals,
            ),
          );
          const dailyInterest = calculateDailyInterestCost({
            borrowAmount,
            borrowApy: row.original.borrowApy,
          });
          const loanUsdPrice = parseFloat(
            getTokenPrice(row.original.loanToken, prices),
          );
          const dailyInterestUsd = dailyInterest * loanUsdPrice;

          return (
            <div className="flex flex-col items-center">
              <span className="text-h5 text-blue-500">
                {formatPercentage(row.original.borrowApy * 100)}
              </span>
              <span className="text-caption text-gray-500">
                {t("pages.borrow.daily-interest-per-day", {
                  value: formatFiatNumber(dailyInterestUsd),
                })}
              </span>
            </div>
          );
        },
        header: () => (
          <Header align="center" text={t("pages.borrow.borrow-apr")} />
        ),
        id: "borrow-apr",
        meta: { className: "justify-center mx-3", width: "80px" },
      },
      {
        cell: ({ row }) => (
          <ManageButton
            marketId={row.original.marketId}
            onAction={(action) =>
              setBorrowAction({
                borrowAction: action,
                marketId: row.original.marketId,
              })
            }
          />
        ),
        header: () => <Header text="" />,
        id: "actions",
        meta: { className: "justify-end", width: "100px" },
      },
    ],
    [prices, setBorrowAction, t],
  );

  const renderAfterRow = function (row: PositionRow | null) {
    if (!row) {
      return null;
    }
    if (!isPositionAtRisk(row.healthFactor)) {
      return null;
    }
    return (
      <LiquidationWarning
        healthFactor={formatHealthFactor(row.healthFactor)!}
        lltv={row.lltv}
        marketId={row.marketId}
      />
    );
  };

  return (
    <div id="borrow-positions" ref={ref}>
      <SectionHeader title={t("pages.borrow.positions-title")} />
      <Table
        columns={columns}
        data={data}
        loading={isMarketsLoading || isPositionsLoading}
        placeholder={
          address ? <PositionsEmptyState /> : <PositionsDisconnectedState />
        }
        renderAfterRow={renderAfterRow}
      />
      {activeMarket && (
        <>
          {borrowAction === "borrow-more" && (
            <Suspense>
              <BorrowMoreDrawerForm
                market={activeMarket}
                onClose={clearBorrowAction}
              />
            </Suspense>
          )}
          {borrowAction === "supply-collateral" && (
            <Suspense>
              <SupplyCollateralDrawerForm
                market={activeMarket}
                onClose={clearBorrowAction}
              />
            </Suspense>
          )}
          {borrowAction === "supply-collateral-and-borrow" && (
            <Suspense>
              <SupplyCollateralAndBorrowDrawerForm
                market={activeMarket}
                onClose={clearBorrowAction}
              />
            </Suspense>
          )}
          {borrowAction === "repay-loan" && (
            <Suspense>
              <RepayLoanDrawerForm
                market={activeMarket}
                onClose={clearBorrowAction}
              />
            </Suspense>
          )}
          {borrowAction === "withdraw-collateral" && (
            <Suspense>
              <WithdrawCollateralDrawerForm
                market={activeMarket}
                onClose={clearBorrowAction}
              />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
}
