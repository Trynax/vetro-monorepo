import { type MarketId } from "@morpho-org/blue-sdk";
import { fetchAccrualPosition } from "@morpho-org/blue-sdk-viem";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { mainnet } from "networks/mainnet";
import type { Address, Chain, Client, Hash } from "viem";
import { useAccount } from "wagmi";

import { useEthereumClient } from "../useEthereumClient";

export const positionInfoQueryKey = ({
  account,
  chainId,
  marketId,
}: {
  account: Address | undefined;
  chainId: Chain["id"];
  marketId: Hash;
}) => ["position-info", chainId, marketId, account];

export const positionInfoOptions = ({
  account,
  chainId,
  client,
  marketId,
}: {
  account: Address | undefined;
  chainId: Chain["id"];
  client: Client | undefined;
  marketId: Hash;
}) =>
  queryOptions({
    enabled: !!client && !!account,
    queryFn: () =>
      fetchAccrualPosition(account!, marketId as MarketId, client!),
    queryKey: positionInfoQueryKey({ account, chainId, marketId }),
  });

export const usePositionInfo = function (marketId: Hash) {
  const { address: account } = useAccount();
  const client = useEthereumClient();

  return useQuery(
    positionInfoOptions({
      account,
      chainId: mainnet.id,
      client: client!,
      marketId,
    }),
  );
};
