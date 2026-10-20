import { queryOptions, useQuery } from "@tanstack/react-query";
import { previewRedeem } from "@vetro-protocol/gateway/actions";
import { mainnet } from "networks/mainnet";
import type { Address, Chain, Client } from "viem";

import { useEthereumClient } from "./useEthereumClient";

export const previewRedeemQueryKey = ({
  chainId,
  gatewayAddress,
  peggedTokenIn,
  tokenOut,
}: {
  chainId: Chain["id"];
  gatewayAddress: Address;
  peggedTokenIn: bigint;
  tokenOut: Address;
}) => [
  "preview-redeem",
  chainId,
  gatewayAddress,
  tokenOut,
  peggedTokenIn.toString(),
];

export const previewRedeemTokenOptions = ({
  chainId,
  client,
  gatewayAddress,
  peggedTokenIn,
  tokenOut,
}: {
  chainId: Chain["id"];
  client: Client;
  gatewayAddress: Address;
  peggedTokenIn: bigint;
  tokenOut: Address;
}) =>
  queryOptions({
    enabled: !!client,
    queryFn: () =>
      peggedTokenIn > 0n
        ? previewRedeem(client, {
            address: gatewayAddress,
            peggedTokenIn,
            tokenOut,
          })
        : 0n,
    queryKey: previewRedeemQueryKey({
      chainId,
      gatewayAddress,
      peggedTokenIn,
      tokenOut,
    }),
  });

export const usePreviewRedeem = function ({
  gatewayAddress,
  peggedTokenIn,
  tokenOut,
}: {
  gatewayAddress: Address;
  peggedTokenIn: bigint;
  tokenOut: Address;
}) {
  const client = useEthereumClient();

  return useQuery(
    previewRedeemTokenOptions({
      chainId: mainnet.id,
      client: client!,
      gatewayAddress,
      peggedTokenIn,
      tokenOut,
    }),
  );
};
