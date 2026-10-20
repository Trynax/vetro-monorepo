import { queryOptions, useQuery } from "@tanstack/react-query";
import fetch from "fetch-plus-plus";
import type { TvlHistoryEntry } from "types";
import type { ChartPeriod } from "utils/chartPeriods";
import type { Address } from "viem";

const apiUrl = import.meta.env.VITE_VETRO_API_URL;

const tvlHistoryOptions = ({
  gatewayAddress,
  period,
}: {
  gatewayAddress: Address | undefined;
  period: ChartPeriod;
}) =>
  queryOptions({
    enabled:
      apiUrl !== undefined &&
      URL.canParse(apiUrl) &&
      gatewayAddress !== undefined,
    queryFn: () =>
      fetch(
        `${apiUrl}/analytics/tvl-history/${gatewayAddress}/${period}`,
      ) as Promise<TvlHistoryEntry[]>,
    queryKey: ["analytics-tvl-history", gatewayAddress, period],
    staleTime: 5 * 60 * 1000,
  });

export const useTvlHistory = ({
  gatewayAddress,
  period,
}: {
  gatewayAddress: Address | undefined;
  period: ChartPeriod;
}) => useQuery(tvlHistoryOptions({ gatewayAddress, period }));
