import { queryOptions, useQuery } from "@tanstack/react-query";
import fetch from "fetch-plus-plus";
import type { Address } from "viem";

const apiUrl = import.meta.env.VITE_VETRO_API_URL;

type StakedResponse = {
  staked: string;
};

const analyticsStakedQueryKey = (gatewayAddress: Address | undefined) => [
  "analytics-staked",
  gatewayAddress,
];

const analyticsStakedOptions = (gatewayAddress: Address | undefined) =>
  queryOptions({
    enabled:
      apiUrl !== undefined &&
      URL.canParse(apiUrl) &&
      gatewayAddress !== undefined,
    queryFn: () =>
      (
        fetch(
          `${apiUrl}/analytics/staked/${gatewayAddress}`,
        ) as Promise<StakedResponse>
      ).then(({ staked }) => ({ staked: BigInt(staked) })),
    queryKey: analyticsStakedQueryKey(gatewayAddress),
    refetchInterval: 60 * 1000, // 1 minute
    staleTime: 60 * 1000, // 1 minute
  });

export const useAnalyticsStaked = (gatewayAddress: Address | undefined) =>
  useQuery(analyticsStakedOptions(gatewayAddress));
