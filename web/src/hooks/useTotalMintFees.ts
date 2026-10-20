import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTotalMintFees } from "fetchers/fetchTotalMintFees";
import { mainnet } from "networks/mainnet";
import type { TokenWithGateway } from "types";
import { useAccount } from "wagmi";

import { useEthereumClient } from "./useEthereumClient";

export const useTotalMintFees = function ({
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

  return useQuery({
    enabled:
      !!client &&
      !!owner &&
      amount > 0n &&
      minPeggedTokenOut !== undefined &&
      minPeggedTokenOut > 0n,
    queryFn: () =>
      fetchTotalMintFees({
        amount,
        approveAmount,
        chain: mainnet,
        client: client!,
        fromToken,
        minPeggedTokenOut: minPeggedTokenOut!,
        owner: owner!,
        queryClient,
      }),
    queryKey: [
      "total-mint-fees",
      mainnet.id,
      fromToken.gatewayAddress,
      fromToken.address,
      owner,
      amount.toString(),
      minPeggedTokenOut?.toString(),
    ],
  });
};
