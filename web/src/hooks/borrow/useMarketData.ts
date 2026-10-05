import {
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { fetchMarketData } from "fetchers/fetchMarketData";
import { mainnet } from "networks/mainnet";
import type { Address, Chain, Client, Hash } from "viem";

import { useEthereumClient } from "../useEthereumClient";

export type MarketData = {
  borrowApy: number;
  collateralToken: Token;
  liquidity: bigint;
  lltv: bigint;
  loanToken: Token;
  marketId: Hash;
  oracle: Address;
  totalBorrowAssets: bigint;
  totalSupplyAssets: bigint;
};

export const marketDataQueryKey = ({
  chainId,
  marketId,
}: {
  chainId: Chain["id"];
  marketId: Hash;
}) => ["market-data", chainId, marketId];

export const marketDataOptions = ({
  chainId,
  client,
  marketId,
  queryClient,
}: {
  chainId: Chain["id"];
  client: Client | undefined;
  marketId: Hash;
  queryClient: QueryClient;
}) =>
  queryOptions({
    enabled: !!client,
    queryFn: () =>
      fetchMarketData({ chainId, client: client!, marketId, queryClient }),
    queryKey: marketDataQueryKey({ chainId, marketId }),
  });

export const useMarketData = function (marketId: Hash) {
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  return useQuery(
    marketDataOptions({
      chainId: mainnet.id,
      client: client!,
      marketId,
      queryClient,
    }),
  );
};
