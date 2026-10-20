import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gatewayAbi, type RequestRedeemEvents } from "@vetro-protocol/gateway";
import { requestRedeem } from "@vetro-protocol/gateway/actions";
import type { EventEmitter } from "events";
import { mainnet } from "networks/mainnet";
import type { TokenWithGateway } from "types";
import { type Address, parseEventLogs } from "viem";
import { useAccount } from "wagmi";

import { useEthereumWalletClient } from "./useEthereumWalletClient";
import { redeemRequestQueryKey } from "./useGetRedeemRequest";
import { redeemRequestsQueryKey } from "./useGetRedeemRequests";

export const useRequestRedeem = function ({
  approveAmount,
  gatewayAddress,
  onEmitter,
  peggedToken,
  peggedTokenAmount,
}: {
  approveAmount?: bigint;
  gatewayAddress: Address;
  onEmitter?: (emitter: EventEmitter<RequestRedeemEvents>) => void;
  peggedToken: TokenWithGateway;
  peggedTokenAmount: bigint;
}) {
  const { address } = useAccount();
  const { data: walletClient } = useEthereumWalletClient();
  const ensureConnectedTo = useEnsureConnectedTo();
  const { queryKey: nativeBalanceKey } = useNativeBalance(mainnet.id);
  const queryClient = useQueryClient();

  const peggedTokenBalanceQueryKey = tokenBalanceQueryKey(peggedToken, address);

  const updateNativeBalanceAfterReceipt = useUpdateNativeBalanceAfterReceipt(
    mainnet.id,
  );

  return useMutation({
    async mutationFn() {
      if (!address) {
        throw new Error("No account connected");
      }

      await ensureConnectedTo(mainnet.id);

      const { emitter, promise } = requestRedeem(walletClient!, {
        approveAmount,
        gatewayAddress,
        peggedTokenAmount,
      });

      emitter.on("request-redeem-transaction-reverted", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
      });
      emitter.on("request-redeem-transaction-succeeded", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
        queryClient.setQueryData(
          peggedTokenBalanceQueryKey,
          (old: bigint) => old - peggedTokenAmount,
        );
        // event is always emitted
        const events = parseEventLogs({
          abi: gatewayAbi,
          eventName: "RedeemRequested",
          logs: receipt.logs,
        });
        if (events?.[0]) {
          const [{ args }] = events;
          queryClient.setQueryData(
            redeemRequestQueryKey({
              address,
              chainId: mainnet.id,
              gatewayAddress,
            }),
            // event includes the updated amount and claimableAt
            [args.amount, args.claimableAt] as [bigint, bigint],
          );
        }
      });

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
          gatewayAddress,
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
