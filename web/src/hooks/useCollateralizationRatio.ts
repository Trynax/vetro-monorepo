import { queryOptions, useQuery } from "@tanstack/react-query";
import fetch from "fetch-plus-plus";
import type { Address } from "viem";

const apiUrl = import.meta.env.VITE_VETRO_API_URL;

type CollateralizationRatio = {
  ratio: number;
  strategicReserves: string;
  supply: string;
  surplus: string;
  total: string;
  treasuryTotal: string;
};

const collateralizationRatioOptions = (gatewayAddress: Address | undefined) =>
  queryOptions({
    enabled:
      apiUrl !== undefined &&
      URL.canParse(apiUrl) &&
      gatewayAddress !== undefined,
    queryFn: () =>
      fetch(
        `${apiUrl}/analytics/collateralization-ratio/${gatewayAddress}`,
      ) as Promise<CollateralizationRatio>,
    queryKey: ["collateralization-ratio", gatewayAddress],
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

export const useCollateralizationRatio = (
  gatewayAddress: Address | undefined,
) => useQuery(collateralizationRatioOptions(gatewayAddress));
