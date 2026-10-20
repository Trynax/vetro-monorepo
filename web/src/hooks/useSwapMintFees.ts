import { useEstimateFees } from "@hemilabs/react-hooks/useEstimateFees";
import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchMintGasUnits } from "fetchers/fetchMintGasUnits";
import { mainnet } from "networks/mainnet";
import type { TokenWithGateway } from "types";
import { type Address, type Chain, type Client } from "viem";
import { useAccount } from "wagmi";

import { useEthereumClient } from "./useEthereumClient";

export const mintGasUnitsOptions = ({
  amount,
  approveAmount,
  chainId,
  client,
  fromToken,
  minPeggedTokenOut,
  owner,
  queryClient,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  chainId: Chain["id"];
  client: Client | undefined;
  fromToken: TokenWithGateway;
  minPeggedTokenOut: bigint | undefined;
  owner: Address | undefined;
  queryClient: QueryClient;
}) =>
  queryOptions({
    enabled:
      !!client &&
      !!owner &&
      amount > 0n &&
      minPeggedTokenOut !== undefined &&
      minPeggedTokenOut > 0n,
    queryFn: () =>
      fetchMintGasUnits({
        amount,
        approveAmount,
        client: client!,
        minPeggedTokenOut: minPeggedTokenOut!,
        owner: owner!,
        queryClient,
        token: fromToken,
      }),
    queryKey: [
      "swap-mint-gas-units",
      chainId,
      fromToken.gatewayAddress,
      fromToken.address,
      owner,
      amount.toString(),
      minPeggedTokenOut?.toString(),
    ],
  });

export const useSwapMintFees = function ({
  amount,
  approveAmount,
  fromToken,
  minPeggedTokenOut,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  fromToken: TokenWithGateway;
  minPeggedTokenOut: bigint | undefined;
}) {
  const { address: owner } = useAccount();
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  const { data: gasUnits, isError: isGasUnitsError } = useQuery(
    mintGasUnitsOptions({
      amount,
      approveAmount,
      chainId: mainnet.id,
      client,
      fromToken,
      minPeggedTokenOut,
      owner,
      queryClient,
    }),
  );

  return useEstimateFees({
    chainId: mainnet.id,
    gasUnits,
    isGasUnitsError,
  });
};
