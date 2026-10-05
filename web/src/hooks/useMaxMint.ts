import { queryOptions, useQuery } from "@tanstack/react-query";
import { getMaxMint } from "@vetro-protocol/gateway/actions";
import { mainnet } from "networks/mainnet";
import type { Address, Chain, Client } from "viem";

import { useEthereumClient } from "./useEthereumClient";

export const maxMintQueryKey = ({
  chainId,
  gatewayAddress,
}: {
  chainId: Chain["id"];
  gatewayAddress: Address;
}) => ["max-mint", chainId, gatewayAddress];

const maxMintOptions = ({
  chainId,
  client,
  gatewayAddress,
}: {
  chainId: Chain["id"];
  client: Client | undefined;
  gatewayAddress: Address;
}) =>
  queryOptions({
    enabled: !!client,
    queryFn: () => getMaxMint(client!, { address: gatewayAddress }),
    queryKey: maxMintQueryKey({
      chainId,
      gatewayAddress,
    }),
  });

export const useMaxMint = function ({
  gatewayAddress,
}: {
  gatewayAddress: Address;
}) {
  const client = useEthereumClient();

  return useQuery(
    maxMintOptions({
      chainId: mainnet.id,
      client,
      gatewayAddress,
    }),
  );
};
