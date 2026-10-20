import { type MarketId } from "@morpho-org/blue-sdk";
import { fetchMarket } from "@morpho-org/blue-sdk-viem";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { mainnet } from "networks/mainnet";
import { unixNowTimestamp } from "utils/date";
import type { Chain, Client, Hash } from "viem";

import { useEthereumClient } from "../useEthereumClient";

export const morphoMarketQueryKey = ({
  chainId,
  marketId,
}: {
  chainId: Chain["id"];
  marketId: Hash;
}) => ["morpho-market", chainId, marketId];

export const morphoMarketOptions = ({
  chainId,
  client,
  marketId,
}: {
  chainId: Chain["id"];
  client: Client | undefined;
  marketId: Hash;
}) =>
  queryOptions({
    enabled: !!client,
    queryFn: () =>
      fetchMarket(marketId as MarketId, client!).then((market) =>
        market.accrueInterest(BigInt(unixNowTimestamp())),
      ),
    queryKey: morphoMarketQueryKey({ chainId, marketId }),
  });

export const useMorphoMarket = function (marketId: Hash) {
  const client = useEthereumClient();

  return useQuery(
    morphoMarketOptions({
      chainId: mainnet.id,
      client: client!,
      marketId,
    }),
  );
};
