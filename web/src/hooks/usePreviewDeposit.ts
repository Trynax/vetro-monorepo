import { useQuery, queryOptions } from "@tanstack/react-query";
import { previewDeposit } from "@vetro-protocol/gateway/actions";
import { mainnet } from "networks/mainnet";
import type { Address, Chain, Client } from "viem";

import { useEthereumClient } from "./useEthereumClient";

export const previewDepositQueryKey = ({
  amountIn,
  chainId,
  gatewayAddress,
  tokenIn,
}: {
  amountIn: bigint;
  chainId: Chain["id"];
  gatewayAddress: Address;
  tokenIn: Address;
}) => [
  "preview-deposit",
  chainId,
  gatewayAddress,
  tokenIn,
  amountIn.toString(),
];

export const previewDepositTokenOptions = ({
  amountIn,
  chainId,
  client,
  gatewayAddress,
  tokenIn,
}: {
  amountIn: bigint;
  client: Client;
  chainId: Chain["id"];
  gatewayAddress: Address;
  tokenIn: Address;
}) =>
  queryOptions({
    enabled: !!client,
    queryFn: () =>
      amountIn > 0n
        ? previewDeposit(client, {
            address: gatewayAddress,
            amountIn,
            tokenIn,
          })
        : 0n,
    queryKey: previewDepositQueryKey({
      amountIn,
      chainId,
      gatewayAddress,
      tokenIn,
    }),
  });

export const usePreviewDeposit = function ({
  amountIn,
  gatewayAddress,
  tokenIn,
}: {
  amountIn: bigint;
  gatewayAddress: Address;
  tokenIn: Address;
}) {
  const client = useEthereumClient();

  return useQuery(
    previewDepositTokenOptions({
      amountIn,
      chainId: mainnet.id,
      client: client!,
      gatewayAddress,
      tokenIn,
    }),
  );
};
