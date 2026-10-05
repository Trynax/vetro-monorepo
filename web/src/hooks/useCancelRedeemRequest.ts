import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CancelRedeemRequestEvents } from "@vetro-protocol/gateway";
import { cancelRedeemRequest } from "@vetro-protocol/gateway/actions";
import type { EventEmitter } from "events";
import { mainnet } from "networks/mainnet";
import type { TokenWithGateway } from "types";
import { useAccount } from "wagmi";

import { useEthereumWalletClient } from "./useEthereumWalletClient";
import { redeemRequestQueryKey } from "./useGetRedeemRequest";
import { redeemRequestsQueryKey } from "./useGetRedeemRequests";

export const useCancelRedeemRequest = function ({
  onEmitter,
  peggedToken,
  redeemableAmount,
}: {
  onEmitter?: (emitter: EventEmitter<CancelRedeemRequestEvents>) => void;
  peggedToken: TokenWithGateway;
  redeemableAmount: bigint;
}) {
  const { address } = useAccount();
  const { data: walletClient } = useEthereumWalletClient();
  const ensureConnectedTo = useEnsureConnectedTo();
  const { queryKey: nativeBalanceKey } = useNativeBalance(mainnet.id);
  const queryClient = useQueryClient();
  const updateNativeBalanceAfterReceipt = useUpdateNativeBalanceAfterReceipt(
    mainnet.id,
  );

  const peggedTokenBalanceQueryKey = tokenBalanceQueryKey(peggedToken, address);

  return useMutation({
    async mutationFn() {
      if (!address) {
        throw new Error("No account connected");
      }

      await ensureConnectedTo(mainnet.id);

      const { emitter, promise } = cancelRedeemRequest(walletClient!, {
        gatewayAddress: peggedToken.gatewayAddress,
      });

      emitter.on("cancel-redeem-request-transaction-reverted", (receipt) =>
        updateNativeBalanceAfterReceipt(receipt),
      );

      emitter.on(
        "cancel-redeem-request-transaction-succeeded",
        function (receipt) {
          updateNativeBalanceAfterReceipt(receipt);
          // PeggedToken balance increases as these are transferred back to the user
          queryClient.setQueryData(
            peggedTokenBalanceQueryKey,
            (old: bigint) => old + redeemableAmount,
          );
          // The redeem request is cleared
          queryClient.setQueryData(
            redeemRequestQueryKey({
              address,
              chainId: mainnet.id,
              gatewayAddress: peggedToken.gatewayAddress,
            }),
            [0n, 0n] as [bigint, bigint],
          );
        },
      );

      onEmitter?.(emitter);

      return promise;
    },
    onSettled() {
      queryClient.invalidateQueries({
        queryKey: nativeBalanceKey,
      });
      queryClient.invalidateQueries({
        queryKey: redeemRequestQueryKey({
          address,
          chainId: mainnet.id,
          gatewayAddress: peggedToken.gatewayAddress,
        }),
      });
      queryClient.invalidateQueries({
        queryKey: redeemRequestsQueryKey({
          address,
          chainId: mainnet.id,
        }),
      });
      queryClient.invalidateQueries({
        queryKey: peggedTokenBalanceQueryKey,
      });
    },
  });
};
