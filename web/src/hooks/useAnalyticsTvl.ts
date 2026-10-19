import { queryOptions, useQuery } from "@tanstack/react-query";
import fetch from "fetch-plus-plus";
import type { Address } from "viem";

const apiUrl = import.meta.env.VITE_VETRO_API_URL;

type TvlResponse = {
  minted: string;
};

const analyticsTvlQueryKey = (gatewayAddress: Address | undefined) => [
  "analytics-tvl",
  gatewayAddress,
];

const analyticsTvlOptions = (gatewayAddress: Address | undefined) =>
  queryOptions({
    enabled:
      apiUrl !== undefined &&
      URL.canParse(apiUrl) &&
      gatewayAddress !== undefined,
    queryFn: () =>
      (
        fetch(
          `${apiUrl}/analytics/tvl/${gatewayAddress}`,
        ) as Promise<TvlResponse>
      ).then(({ minted }) => ({ minted: BigInt(minted) })),
    queryKey: analyticsTvlQueryKey(gatewayAddress),
    refetchInterval: 60 * 1000, // 1 minute
    staleTime: 60 * 1000, // 1 minute
  });

export const useAnalyticsTvl = (gatewayAddress: Address | undefined) =>
  useQuery(analyticsTvlOptions(gatewayAddress));
