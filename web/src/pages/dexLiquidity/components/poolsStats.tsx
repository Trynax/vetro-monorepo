import { InfoCard } from "components/base/infoCard";
import { PieChartIcon } from "components/icons/pieChartIcon";
import { TrendingUpIcon } from "components/icons/trendingUpIcon";
import { useTranslation } from "react-i18next";
import { formatUsd } from "utils/currency";

import { useDexPools } from "../hooks/useDexPools";
import { getPoolsTotals } from "../utils";

export function PoolsStats() {
  const { data, isLoading } = useDexPools();
  const { t } = useTranslation();

  const totals = data ? getPoolsTotals(data) : undefined;

  return (
    <div className="flex flex-col border-t border-gray-200 bg-gray-100 *:border-0 md:flex-row md:justify-center md:gap-14 md:px-14 md:*:w-[267px]">
      <InfoCard
        data={totals?.tvlUsd}
        icon={<PieChartIcon className="text-blue-500" />}
        isLoading={isLoading}
        label={t("pages.dex-liquidity.total-tvl")}
        render={formatUsd}
      />
      <InfoCard
        data={totals?.volumeUsd24h}
        icon={<TrendingUpIcon className="text-blue-500" />}
        isLoading={isLoading}
        label={t("pages.dex-liquidity.volume-24h")}
        render={formatUsd}
      />
    </div>
  );
}
