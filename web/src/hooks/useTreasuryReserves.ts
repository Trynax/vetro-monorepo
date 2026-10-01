import {
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { fetchTreasuryReserves } from "fetchers/fetchTreasuryReserves";
import { mainnet } from "networks/mainnet";
import type { Address, Chain, Client } from "viem";

import { useEthereumClient } from "./useEthereumClient";

export const treasuryReservesQueryKey = ({
  chainId,
  gatewayAddress,
}: {
  chainId: Chain["id"];
  gatewayAddress: Address;
}) => ["treasury-reserves", chainId, gatewayAddress];

export const treasuryReservesOptions = ({
  chainId,
  client,
  gatewayAddress,
  queryClient,
}: {
  chainId: Chain["id"];
  client: Client;
  gatewayAddress: Address;
  queryClient: QueryClient;
}) =>
  queryOptions({
    enabled: !!client?.chain,
    queryFn: () =>
      fetchTreasuryReserves({ client, gatewayAddress, queryClient }),
    queryKey: treasuryReservesQueryKey({ chainId, gatewayAddress }),
  });

export const useTreasuryReserves = function (gatewayAddress: Address) {
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  return useQuery(
    treasuryReservesOptions({
      chainId: mainnet.id,
      client: client!,
      gatewayAddress,
      queryClient,
    }),
  );
};
