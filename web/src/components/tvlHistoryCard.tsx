import { useQueries } from "@tanstack/react-query";
import { SegmentedControl } from "components/base/segmentedControl";
import { ChartPlaceholder } from "components/chartPlaceholders";
import { ClockRevertedIcon } from "components/icons/clockRevertedIcon";
import { useAnalyticsTvl } from "hooks/useAnalyticsTvl";
import { useElementWidth } from "hooks/useElementWidth";
import { useEthereumClient } from "hooks/useEthereumClient";
import { useMainnet } from "hooks/useMainnet";
import { usePrices } from "hooks/usePrices";
import { tokenInfoOptions } from "hooks/useTokenInfo";
import { useTvlHistory } from "hooks/useTvlHistory";
import { useWhitelistedTokensByGateway } from "hooks/useWhitelistedTokensByGateway";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import type { TokenWithGateway } from "types";
import {
  getHistoryOnlyTokenAddresses,
  toTvlHistorySeries,
} from "utils/allocations";
import {
  type ChartPeriod,
  chartPeriods,
  periodLabelKeys,
} from "utils/chartPeriods";
import {
  chartHeight,
  chartPadding,
  tooltipProps,
  xAxisStyle,
  yAxisStyle,
} from "utils/chartTheme";
import { formatTokenAmountUsd, formatUsd } from "utils/currency";
import { formatDate, formatShortDate } from "utils/date";
import {
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryLabel,
  VictoryStack,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from "victory";

type Series = ReturnType<typeof toTvlHistorySeries>;

const tooltipFlyoutWidth = 150;
const tooltipSwatchSize = 8;
const tooltipFontSize = 11;
const tooltipLineHeight = 1.6;
const tooltipLineSpacing = tooltipFontSize * tooltipLineHeight;
const tooltipFlyoutHeight = (lines: number) =>
  (lines + 2) * tooltipLineSpacing + 16;
const tooltipTextDx = -tooltipFlyoutWidth / 2 + 12 + tooltipSwatchSize + 6;

const minBarDomainPadding = 12;

const loadingBarHeights = [46, 62, 54, 70, 58, 74, 64, 80, 68, 86, 76, 92];

function TvlTooltipLabel(props: {
  activePoints?: { style?: { data?: { fill?: string } }; y: number }[];
  datum?: { x?: number };
  text?: string[] | string;
  x?: number;
  y?: number;
}) {
  const { i18n, t } = useTranslation();
  const { activePoints = [], datum, text, x = 0, y = 0 } = props;
  const lines = Array.isArray(text) ? text : [text ?? ""];
  const swatchX = x - tooltipFlyoutWidth / 2 + 12;
  const firstRowY = y - ((lines.length + 1) / 2) * tooltipLineSpacing;
  const total = activePoints.reduce((sum, point) => sum + point.y, 0);

  return (
    <g>
      <text
        dominantBaseline="middle"
        style={{
          fill: xAxisStyle.tickLabels.fill,
          fontSize: tooltipFontSize,
        }}
        textAnchor="start"
        x={swatchX}
        y={firstRowY}
      >
        {datum?.x === undefined
          ? ""
          : formatDate(datum.x / 1000, i18n.language, "UTC")}
      </text>
      {lines.map((_, index) => (
        <rect
          fill={activePoints[index]?.style?.data?.fill}
          height={tooltipSwatchSize}
          key={index}
          rx={2}
          width={tooltipSwatchSize}
          x={swatchX}
          y={
            firstRowY + (index + 1) * tooltipLineSpacing - tooltipSwatchSize / 2
          }
        />
      ))}
      <VictoryLabel
        {...props}
        dx={tooltipTextDx}
        lineHeight={tooltipLineHeight}
        textAnchor="start"
      />
      <text
        dominantBaseline="middle"
        style={{ fontSize: tooltipFontSize, fontWeight: 600 }}
        textAnchor="start"
        x={swatchX}
        y={firstRowY + (lines.length + 1) * tooltipLineSpacing}
      >
        {`${t("common.charts.total-label")}  ${formatUsd(total)}`}
      </text>
    </g>
  );
}

function TvlHistoryChart({
  chartWidth,
  series,
}: {
  chartWidth: number;
  series: Series;
}) {
  const { i18n } = useTranslation();
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const halfBarWidth = plotWidth / (4 * ((series[0]?.data.length ?? 0) + 2));

  return (
    <VictoryChart
      containerComponent={
        <VictoryVoronoiContainer
          labelComponent={
            <VictoryTooltip
              {...tooltipProps}
              flyoutHeight={tooltipFlyoutHeight(series.length)}
              flyoutWidth={tooltipFlyoutWidth}
              labelComponent={<TvlTooltipLabel />}
            />
          }
          labels={({ datum }: { datum: { childName: string; y: number } }) =>
            `${datum.childName}  ${formatUsd(datum.y)}`
          }
          voronoiDimension="x"
        />
      }
      domainPadding={{
        x: Math.max(minBarDomainPadding, Math.ceil(halfBarWidth)),
      }}
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
      <VictoryAxis dependentAxis style={yAxisStyle} tickFormat={formatUsd} />
      <VictoryStack>
        {series.map((token) => (
          <VictoryBar
            data={token.data}
            key={token.address}
            name={token.symbol}
            style={{ data: { fill: token.color } }}
          />
        ))}
      </VictoryStack>
    </VictoryChart>
  );
}

function TvlHistoryValue({
  peggedToken,
  peggedTokenError,
}: {
  peggedToken: TokenWithGateway | undefined;
  peggedTokenError: boolean;
}) {
  const { data: prices, isError: isPricesError } = usePrices();
  const { data: tvl, isError: isTvlError } = useAnalyticsTvl(
    peggedToken?.gatewayAddress,
  );

  const renderValue = function () {
    if (peggedTokenError || isTvlError || isPricesError) return "-";
    if (!peggedToken || !tvl || !prices) {
      return <Skeleton height={28} width={120} />;
    }
    // The supply, not the sum of the bars: the bars include the surplus.
    return formatTokenAmountUsd({
      amount: tvl.minted,
      prices,
      token: peggedToken,
    });
  };

  return <h3 className="text-gray-900">{renderValue()}</h3>;
}

type TvlHistoryCardProps = {
  peggedToken: TokenWithGateway | undefined;
  peggedTokenError?: boolean;
};

export function TvlHistoryCard({
  peggedToken,
  peggedTokenError = false,
}: TvlHistoryCardProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ChartPeriod>("3m");
  const [chartContainerRef, chartWidth] = useElementWidth();
  const client = useEthereumClient();
  const mainnet = useMainnet();
  const {
    data: whitelistedTokens,
    isError: isWhitelistedTokensError,
    refetch: refetchWhitelistedTokens,
  } = useWhitelistedTokensByGateway(peggedToken?.gatewayAddress);
  const {
    data: history,
    isError: isHistoryError,
    refetch: refetchHistory,
  } = useTvlHistory({
    gatewayAddress: peggedToken?.gatewayAddress,
    period,
  });

  const historyOnlyTokens = useQueries({
    combine: (results) => ({
      data: results.every((result) => result.data !== undefined)
        ? results.map((result) => result.data!)
        : undefined,
      isError: results.some((result) => result.isError),
      refetch: () =>
        results
          .filter((result) => result.isError)
          .forEach((result) => result.refetch()),
    }),
    queries:
      history && whitelistedTokens
        ? getHistoryOnlyTokenAddresses({ history, whitelistedTokens }).map(
            (address) =>
              tokenInfoOptions({ address, chainId: mainnet.id, client }),
          )
        : [],
  });

  const series = useMemo(
    () =>
      history && whitelistedTokens && historyOnlyTokens.data
        ? toTvlHistorySeries({
            history,
            tokens: [...whitelistedTokens, ...historyOnlyTokens.data],
          })
        : undefined,
    [history, historyOnlyTokens.data, whitelistedTokens],
  );

  const reloadChart = function () {
    if (isHistoryError) refetchHistory();
    if (isWhitelistedTokensError) refetchWhitelistedTokens();
    if (historyOnlyTokens.isError) historyOnlyTokens.refetch();
  };

  const renderChart = function () {
    if (peggedTokenError) {
      return (
        <div className="flex h-full items-center justify-center">
          <span className="text-gray-500">-</span>
        </div>
      );
    }
    if (series !== undefined) {
      return <TvlHistoryChart chartWidth={chartWidth} series={series} />;
    }
    return (
      <ChartPlaceholder
        chartWidth={chartWidth}
        isError={
          isHistoryError ||
          isWhitelistedTokensError ||
          historyOnlyTokens.isError
        }
        onReload={reloadChart}
        period={period}
        skeleton={
          <div className="flex h-full items-end gap-[2%]">
            {loadingBarHeights.map((height) => (
              <div
                className="flex-1"
                key={height}
                style={{ height: `${height}%` }}
              >
                <Skeleton height="100%" />
              </div>
            ))}
          </div>
        }
      />
    );
  };

  return (
    <div className="-translate-y-px border-t border-blue-500 py-6">
      <div className="flex flex-col gap-3">
        <div className="flex w-full items-center justify-between">
          <span className="text-b-medium text-gray-900">
            {t("pages.analytics.historic-tvl-label")}
          </span>
          <ClockRevertedIcon className="text-blue-500" />
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <TvlHistoryValue
            peggedToken={peggedToken}
            peggedTokenError={peggedTokenError}
          />
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
        {renderChart()}
      </div>
    </div>
  );
}
