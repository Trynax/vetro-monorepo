import { queryOptions, useQuery } from "@tanstack/react-query";
import fetch from "fetch-plus-plus";
import type { TreasuryToken } from "types";
import type { Address } from "viem";

const apiUrl = import.meta.env.VITE_VETRO_API_URL;

export const analyticsTreasuryQueryKey = (
  gatewayAddress: Address | undefined,
) => ["analytics-treasury", gatewayAddress];

const analyticsTreasuryOptions = ({
  gatewayAddress,
}: {
  gatewayAddress: Address | undefined;
}) =>
  queryOptions({
    enabled:
      apiUrl !== undefined &&
      URL.canParse(apiUrl) &&
      gatewayAddress !== undefined,
    queryFn: () =>
      fetch(`${apiUrl}/analytics/treasury/${gatewayAddress}`) as Promise<
        TreasuryToken[]
      >,
    queryKey: analyticsTreasuryQueryKey(gatewayAddress),
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

export const useAnalyticsTreasury = (gatewayAddress: Address | undefined) =>
  useQuery(analyticsTreasuryOptions({ gatewayAddress }));
