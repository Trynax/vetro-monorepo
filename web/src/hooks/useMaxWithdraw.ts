import { queryOptions, useQuery } from "@tanstack/react-query";
import { getMaxWithdraw } from "@vetro-protocol/gateway/actions";
import { mainnet } from "networks/mainnet";
import type { Address, Chain, Client } from "viem";

import { useEthereumClient } from "./useEthereumClient";

export const maxWithdrawQueryKey = ({
  chainId,
  gatewayAddress,
  tokenOut,
}: {
  chainId: Chain["id"];
  gatewayAddress: Address;
  tokenOut: Address;
}) => ["max-withdraw", chainId, gatewayAddress, tokenOut];

const maxWithdrawOptions = ({
  chainId,
  client,
  gatewayAddress,
  tokenOut,
}: {
  chainId: Chain["id"];
  client: Client | undefined;
  gatewayAddress: Address;
  tokenOut: Address;
}) =>
  queryOptions({
    enabled: !!client,
    queryFn: () =>
      getMaxWithdraw(client!, { address: gatewayAddress, tokenOut }),
    queryKey: maxWithdrawQueryKey({
      chainId,
      gatewayAddress,
      tokenOut,
    }),
  });

export const useMaxWithdraw = function ({
  gatewayAddress,
  tokenOut,
}: {
  gatewayAddress: Address;
  tokenOut: Address;
}) {
  const client = useEthereumClient();

  return useQuery(
    maxWithdrawOptions({
      chainId: mainnet.id,
      client,
      gatewayAddress,
      tokenOut,
    }),
  );
};
