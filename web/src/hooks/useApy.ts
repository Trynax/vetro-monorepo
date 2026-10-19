import { useQuery } from "@tanstack/react-query";
import fetch from "fetch-plus-plus";
import type { Address } from "viem";

const apiUrl = import.meta.env.VITE_VETRO_API_URL;

type ApyResponse = Partial<Record<Address, { apy: number }>>;

export const useApy = (stakingVaultAddress: Address) =>
  useQuery({
    enabled: apiUrl !== undefined && URL.canParse(apiUrl),
    queryFn: () =>
      fetch(`${apiUrl}/variable-stake/apy`) as Promise<ApyResponse>,
    queryKey: ["variable-stake-apy"],
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    // A vault whose reads failed is omitted from the response, so this can be
    // undefined; callers render "-" in that case.
    select: (data) => data[stakingVaultAddress]?.apy,
  });
