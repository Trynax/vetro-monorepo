import { useQueries, useQueryClient } from "@tanstack/react-query";
import { mainnet } from "networks/mainnet";
import type { Hash } from "viem";

import { useEthereumClient } from "../useEthereumClient";

import { type MarketData, marketDataOptions } from "./useMarketData";

export { type MarketData };

export const useMarketsData = function (marketIds: Hash[]) {
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  const queries = useQueries({
    queries: marketIds.map((marketId) =>
      marketDataOptions({
        chainId: mainnet.id,
        client: client!,
        marketId,
        queryClient,
      }),
    ),
  });

  const data = queries.reduce<MarketData[]>(function (acc, query) {
    if (query.data) {
      acc.push(query.data);
    }
    return acc;
  }, []);

  const isLoading = queries.some((q) => q.isLoading);

  return { data, isLoading };
};
