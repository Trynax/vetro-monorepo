import { queryOptions, useQuery } from "@tanstack/react-query";
import type { DexPool } from "@vetro-protocol/core";
import fetch from "fetch-plus-plus";

const apiUrl = import.meta.env.VITE_VETRO_API_URL;

const dexPoolsOptions = () =>
  queryOptions({
    enabled: apiUrl !== undefined && URL.canParse(apiUrl),
    queryFn: () => fetch(`${apiUrl}/dex-liquidity/pools`) as Promise<DexPool[]>,
    queryKey: ["dex-liquidity-pools"],
  });

export const useDexPools = () => useQuery(dexPoolsOptions());
