import { queryOptions, useQuery } from "@tanstack/react-query";
import type { DexPool } from "@vetro-protocol/core";
import fetch from "fetch-plus-plus";

import { isPoolVisible } from "../utils";

const apiUrl = import.meta.env.VITE_VETRO_API_URL;

const selectVisiblePools = (pools: DexPool[]) => pools.filter(isPoolVisible);

const dexPoolsOptions = () =>
  queryOptions({
    enabled: apiUrl !== undefined && URL.canParse(apiUrl),
    queryFn: () => fetch(`${apiUrl}/dex-liquidity/pools`) as Promise<DexPool[]>,
    queryKey: ["dex-liquidity-pools"],
    refetchInterval: 5 * 60 * 1000,
    select: selectVisiblePools,
    staleTime: 60 * 1000,
  });

export const useDexPools = () => useQuery(dexPoolsOptions());
