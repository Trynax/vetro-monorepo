import { SegmentedControl } from "components/base/segmentedControl";
import { ChartPlaceholder } from "components/chartPlaceholders";
import { ClockRevertedIcon } from "components/icons/clockRevertedIcon";
import { useElementWidth } from "hooks/useElementWidth";
import { useShareTokenForPeggedToken } from "hooks/useShareTokenForPeggedToken";
import { useShareValueHistory } from "hooks/useShareValueHistory";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import type { TokenWithGateway } from "types";
import {
  type ChartPeriod,
  chartPeriods,
  periodLabelKeys,
} from "utils/chartPeriods";
import {
  chartHeight,
  chartLineStyle,
  chartPadding,
  tooltipProps,
  xAxisStyle,
  yAxisStyle,
} from "utils/chartTheme";
import { formatDate, formatShortDate } from "utils/date";
import {
  VictoryAxis,
  VictoryChart,
  VictoryLine,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from "victory";

type Props = {
  // Undefined while the page still resolves which pegged token to show.
  peggedToken: TokenWithGateway | undefined;
  peggedTokenError?: boolean;
};

const formatShareValue = (value: number) => value.toFixed(4);

function ShareRatioLabel({ peggedToken, peggedTokenError = false }: Props) {
  const { t } = useTranslation();
  const { data: shareToken, isError: isShareTokenError } =
    useShareTokenForPeggedToken({ peggedToken });

  if (shareToken && peggedToken) {
    return t("common.charts.share-ratio-label", {
      peggedSymbol: peggedToken.symbol,
      shareSymbol: shareToken.symbol,
    });
  }
  if (peggedTokenError || isShareTokenError) {
    return "-";
  }
  return <Skeleton width={160} />;
}

export function ShareRatioCard({
  peggedToken,
  peggedTokenError = false,
}: Props) {
  const { i18n, t } = useTranslation();
  const [period, setPeriod] = useState<ChartPeriod>("1w");
  const [chartContainerRef, chartWidth] = useElementWidth();
  const {
    data: chartData,
    isError: isHistoryError,
    refetch,
  } = useShareValueHistory({ peggedToken, period });

  const isError =
    peggedTokenError || (isHistoryError && chartData === undefined);
  // The API appends the current on-chain share value as the final point, so the last
  // datapoint is the current value (share token measured in pegged tokens) shown on
  // top of the card.
  const currentShareValue = chartData?.at(-1)?.y;

  return (
    <div className="-translate-y-px border-t border-blue-500 py-6">
      <div className="flex flex-col gap-3">
        <div className="flex w-full items-center justify-between">
          <span className="text-b-medium text-gray-900">
            <ShareRatioLabel
              peggedToken={peggedToken}
              peggedTokenError={peggedTokenError}
            />
          </span>
          <ClockRevertedIcon className="text-blue-500" />
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          {isError ? (
            <span className="text-2xl font-semibold text-gray-900">-</span>
          ) : chartData === undefined ? (
            <Skeleton height={32} width={96} />
          ) : (
            <span className="text-2xl font-semibold text-gray-900">
              {currentShareValue !== undefined && peggedToken
                ? `${formatShareValue(currentShareValue)} ${peggedToken.symbol}`
                : "-"}
            </span>
          )}
          <SegmentedControl
            onChange={setPeriod}
            options={chartPeriods.map((p) => ({
              label: t(periodLabelKeys[p]),
              value: p,
            }))}
            size="xs"
            value={period}
            variant="pill"
          />
        </div>
      </div>
      <div
        className="relative mt-6 md:mt-8"
        ref={chartContainerRef}
        style={{ height: chartHeight }}
      >
        {peggedTokenError ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-gray-500">-</span>
          </div>
        ) : chartData === undefined ? (
          <ChartPlaceholder
            chartWidth={chartWidth}
            isError={isHistoryError}
            onReload={() => refetch()}
            period={period}
            skeleton={<Skeleton height="100%" />}
          />
        ) : (
          <VictoryChart
            containerComponent={
              <VictoryVoronoiContainer
                labelComponent={<VictoryTooltip {...tooltipProps} />}
                labels={({ datum }: { datum: { x: number; y: number } }) =>
                  `${formatDate(datum.x / 1000, i18n.language, "UTC")}  ${formatShareValue(datum.y)} ${peggedToken?.symbol ?? ""}`
                }
              />
            }
            height={chartHeight}
            padding={chartPadding}
            width={chartWidth || undefined}
          >
            <VictoryAxis
              style={xAxisStyle}
              tickCount={4}
              tickFormat={(tick: number) =>
                formatShortDate(tick / 1000, i18n.language, "UTC")
              }
            />
            <VictoryAxis
              dependentAxis
              style={yAxisStyle}
              tickFormat={formatShareValue}
            />
            <VictoryLine
              data={chartData}
              interpolation="linear"
              style={chartLineStyle}
            />
          </VictoryChart>
        )}
      </div>
    </div>
  );
}
