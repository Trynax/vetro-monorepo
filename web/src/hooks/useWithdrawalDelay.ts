import {
  type UseQueryOptions,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";
import { getWithdrawalDelay } from "@vetro-protocol/gateway/actions";
import { mainnet } from "networks/mainnet";
import type { Address, Chain, Client } from "viem";

import { useEthereumClient } from "./useEthereumClient";

const withdrawalDelayQueryKey = ({
  chainId,
  gatewayAddress,
}: {
  chainId: Chain["id"] | undefined;
  gatewayAddress: Address;
}) => ["withdrawal-delay", chainId, gatewayAddress];

type WithdrawalDelayQueryKey = ReturnType<typeof withdrawalDelayQueryKey>;
type QueryOptions<TSelect = bigint> = Omit<
  UseQueryOptions<bigint, Error, TSelect, WithdrawalDelayQueryKey>,
  "enabled" | "queryFn" | "queryKey"
>;

export const withdrawalDelayOptions = <TSelect = bigint>({
  chainId,
  client,
  gatewayAddress,
  ...options
}: {
  chainId: Chain["id"];
  client: Client | undefined;
  gatewayAddress: Address;
} & QueryOptions<TSelect>) =>
  queryOptions({
    ...options,
    enabled: !!client,
    queryFn: () => getWithdrawalDelay(client!, { address: gatewayAddress }),
    queryKey: withdrawalDelayQueryKey({ chainId, gatewayAddress }),
  });

export const useWithdrawalDelay = function <TSelect = bigint>({
  gatewayAddress,
  ...options
}: {
  gatewayAddress: Address;
} & QueryOptions<TSelect>) {
  const client = useEthereumClient();

  return useQuery(
    withdrawalDelayOptions({
      ...options,
      chainId: mainnet.id,
      client,
      gatewayAddress,
    }),
  );
};
