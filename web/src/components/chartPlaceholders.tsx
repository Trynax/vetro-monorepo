import { Button } from "components/base/button";
import { RefreshIcon } from "components/icons/refreshIcon";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { type ChartPeriod, getPlaceholderXTicks } from "utils/chartPeriods";
import {
  chartHeight,
  chartPadding,
  xAxisStyle,
  yAxisStyle,
} from "utils/chartTheme";
import { formatShortDate } from "utils/date";
import { VictoryAxis, VictoryChart } from "victory";

type ChartAxisProps = {
  padding?: typeof chartPadding;
  yTickFormat?: (tick: number) => string;
  yTickValues?: number[];
};

function EmptyChart({
  chartWidth,
  padding = chartPadding,
  period,
  yTickFormat = () => "",
  yTickValues,
}: ChartAxisProps & {
  chartWidth: number;
  period: ChartPeriod;
}) {
  const { i18n } = useTranslation();

  return (
    <VictoryChart
      height={chartHeight}
      padding={padding}
      width={chartWidth || undefined}
    >
      <VictoryAxis
        style={xAxisStyle}
        tickFormat={(tick: number) =>
          formatShortDate(tick / 1000, i18n.language, "UTC")
        }
        tickValues={getPlaceholderXTicks(period)}
      />
      <VictoryAxis
        dependentAxis
        style={yAxisStyle}
        tickFormat={yTickFormat}
        tickValues={yTickValues}
      />
    </VictoryChart>
  );
}

export function ChartPlaceholder({
  chartWidth,
  isError,
  onReload,
  padding = chartPadding,
  period,
  skeleton,
  yTickFormat,
  yTickValues,
}: ChartAxisProps & {
  chartWidth: number;
  isError: boolean;
  onReload: () => void;
  period: ChartPeriod;
  skeleton: ReactNode;
}) {
  const { t } = useTranslation();

  if (!isError) {
    return (
      <div className="relative">
        <EmptyChart
          chartWidth={chartWidth}
          padding={padding}
          period={period}
          yTickFormat={yTickFormat}
          yTickValues={yTickValues}
        />
        <div className="absolute" style={padding}>
          {skeleton}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="opacity-32">
        <EmptyChart
          chartWidth={chartWidth}
          padding={padding}
          period={period}
          yTickFormat={yTickFormat}
          yTickValues={yTickValues}
        />
      </div>
      <div
        className="absolute flex items-center justify-center"
        style={padding}
      >
        <Button onClick={onReload} size="xSmall" variant="primary">
          <span className="opacity-72">
            <RefreshIcon className="text-blue-500" />
          </span>
          {t("common.charts.reload-chart")}
        </Button>
      </div>
    </div>
  );
}
