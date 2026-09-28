import { SegmentedControl } from "components/base/segmentedControl";
import { ChartPlaceholder } from "components/chartPlaceholders";
import { ClockRevertedIcon } from "components/icons/clockRevertedIcon";
import {
  type AprHistoryEntry,
  useAprHistory,
} from "hooks/borrow/useAprHistory";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import {
  type ChartPeriod,
  chartPeriods,
  periodLabelKeys,
} from "utils/chartPeriods";
import {
  chartHeight,
  chartLineStyle,
  tooltipProps,
  xAxisStyle,
  yAxisStyle,
} from "utils/chartTheme";
import { formatDate, formatShortDate } from "utils/date";
import { formatPercentage, formatPercentageTick } from "utils/format";
import {
  VictoryArea,
  VictoryAxis,
  VictoryChart,
  VictoryLine,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from "victory";
import type { Hash } from "viem";

type Props = {
  marketId: Hash;
};

const getAverage = function (
  entries: { x: AprHistoryEntry["timestamp"]; y: AprHistoryEntry["apr"] }[],
) {
  if (entries.length === 0) {
    return 0;
  }
  return entries.reduce((sum, e) => sum + e.y, 0) / entries.length;
};

const AreaGradient = () => (
  <defs>
    <linearGradient id="area-gradient" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stopColor="#EAF4FF" />
      <stop offset="100%" stopColor="#EAF4FF" stopOpacity={0} />
    </linearGradient>
  </defs>
);

const periods = chartPeriods;

// Narrower left padding than the shared chartPadding: this chart's y-axis
// shows short percentage labels, so it needs less room.
const chartPadding = { bottom: 30, left: 40, right: 16, top: 10 };

function ChartTooltipLabel({
  datum,
  locale,
  x,
  y,
}: {
  datum?: { x: number; y: number };
  locale: string;
  x?: number;
  y?: number;
}) {
  if (datum === undefined) {
    return null;
  }

  const dateText = formatDate(datum.x / 1000, locale);
  const aprText = formatPercentage(datum.y);

  return (
    <text
      className="text-xss"
      dominantBaseline="central"
      textAnchor="middle"
      x={x}
      y={y}
    >
      <tspan className="fill-gray-500">{dateText}</tspan>
      <tspan className="fill-gray-900" dx={4}>
        {aprText}
      </tspan>
    </text>
  );
}

export function HistoricApr({ marketId }: Props) {
  const { i18n, t } = useTranslation();
  const [period, setPeriod] = useState<ChartPeriod>("1w");
  const { data: chartData, isError, refetch } = useAprHistory(marketId, period);

  return (
    <div className="px-3 py-6 xl:px-14">
      <div className="flex items-center justify-between">
        <span className="text-b-medium text-gray-900">
          {t("pages.borrow.historic-apr")}
        </span>
        <ClockRevertedIcon className="text-blue-500" />
      </div>
      <div className="mt-3 flex flex-col gap-3 gap-y-6 xl:flex-row xl:items-center xl:justify-between">
        <span className="text-h3">
          {chartData !== undefined ? (
            t("pages.borrow.avg", {
              percentage: formatPercentage(getAverage(chartData)),
            })
          ) : isError ? (
            "-"
          ) : (
            <Skeleton width={80} />
          )}
        </span>
        <SegmentedControl
          onChange={setPeriod}
          options={periods.map((p) => ({
            label: t(periodLabelKeys[p]),
            value: p,
          }))}
          size="xs"
          value={period}
          variant="pill"
        />
      </div>
      <div className="relative mt-10">
        {chartData !== undefined ? (
          <VictoryChart
            containerComponent={
              <VictoryVoronoiContainer
                labelComponent={
                  <VictoryTooltip
                    {...tooltipProps}
                    labelComponent={
                      <ChartTooltipLabel locale={i18n.language} />
                    }
                  />
                }
                labels={({ datum }: { datum: { x: number; y: number } }) =>
                  `${formatDate(datum.x / 1000, i18n.language)}  ${formatPercentage(datum.y)}`
                }
                voronoiBlacklist={["area"]}
              />
            }
            height={chartHeight}
            padding={chartPadding}
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
              tickFormat={formatPercentageTick}
            />
            <AreaGradient />
            <VictoryArea
              data={chartData}
              interpolation="linear"
              name="area"
              style={{
                data: {
                  fill: "url(#area-gradient)",
                  stroke: "none",
                },
              }}
            />
            <VictoryLine
              data={chartData}
              interpolation="linear"
              style={chartLineStyle}
            />
          </VictoryChart>
        ) : (
          <ChartPlaceholder
            chartWidth={0}
            isError={isError}
            onReload={() => refetch()}
            padding={chartPadding}
            period={period}
            skeleton={<Skeleton height="100%" />}
            yTickFormat={formatPercentageTick}
            yTickValues={[0, 2, 4, 6]}
          />
        )}
      </div>
    </div>
  );
}
