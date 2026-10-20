import { useEstimateFees } from "@hemilabs/react-hooks/useEstimateFees";
import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchRedeemGasUnits } from "fetchers/fetchRedeemGasUnits";
import { mainnet } from "networks/mainnet";
import type { TokenWithGateway } from "types";
import type { Address, Chain, Client } from "viem";
import { useAccount } from "wagmi";

import { useEthereumClient } from "./useEthereumClient";

export const redeemGasUnitsOptions = ({
  amount,
  approveAmount,
  chainId,
  client,
  fromToken,
  minAmountOut,
  owner,
  queryClient,
  tokenOut,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  chainId: Chain["id"];
  client: Client | undefined;
  fromToken: TokenWithGateway;
  minAmountOut: bigint | undefined;
  owner: Address | undefined;
  queryClient: QueryClient;
  tokenOut: Address;
}) =>
  queryOptions({
    enabled:
      !!client &&
      !!owner &&
      amount > 0n &&
      minAmountOut !== undefined &&
      minAmountOut > 0n,
    queryFn: () =>
      fetchRedeemGasUnits({
        amount,
        approveAmount,
        client: client!,
        minAmountOut: minAmountOut!,
        owner: owner!,
        queryClient,
        token: fromToken,
        tokenOut,
      }),
    queryKey: [
      "swap-redeem-gas-units",
      chainId,
      fromToken.gatewayAddress,
      fromToken.address,
      owner,
      amount.toString(),
      minAmountOut?.toString(),
      tokenOut,
    ],
  });

export const useSwapRedeemFees = function ({
  amount,
  approveAmount,
  fromToken,
  minAmountOut,
  tokenOut,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  fromToken: TokenWithGateway;
  minAmountOut: bigint | undefined;
  tokenOut: Address;
}) {
  const { address: owner } = useAccount();
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  const { data: gasUnits, isError: isGasUnitsError } = useQuery(
    redeemGasUnitsOptions({
      amount,
      approveAmount,
      chainId: mainnet.id,
      client,
      fromToken,
      minAmountOut,
      owner,
      queryClient,
      tokenOut,
    }),
  );

  return useEstimateFees({
    chainId: mainnet.id,
    gasUnits,
    isGasUnitsError,
  });
};
