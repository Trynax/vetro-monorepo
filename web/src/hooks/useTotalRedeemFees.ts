import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTotalRedeemFees } from "fetchers/fetchTotalRedeemFees";
import { mainnet } from "networks/mainnet";
import type { TokenWithGateway } from "types";
import type { Address } from "viem";
import { useAccount } from "wagmi";

import { useEthereumClient } from "./useEthereumClient";

export const useTotalRedeemFees = function ({
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

  return useQuery({
    enabled:
      !!client &&
      !!owner &&
      amount > 0n &&
      minAmountOut !== undefined &&
      minAmountOut > 0n,
    queryFn: () =>
      fetchTotalRedeemFees({
        amount,
        approveAmount,
        chain: mainnet,
        client: client!,
        fromToken,
        minAmountOut: minAmountOut!,
        owner: owner!,
        queryClient,
        tokenOut,
      }),
    queryKey: [
      "total-redeem-fees",
      mainnet.id,
      fromToken.gatewayAddress,
      fromToken.address,
      owner,
      amount.toString(),
      minAmountOut?.toString(),
      tokenOut,
    ],
  });
};
