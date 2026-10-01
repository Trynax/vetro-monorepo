import { allowanceQueryKey } from "@hemilabs/react-hooks/useAllowance";
import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RedeemEvents } from "@vetro-protocol/gateway";
import { redeem } from "@vetro-protocol/gateway/actions";
import type { EventEmitter } from "events";
import { mainnet } from "networks/mainnet";
import type { TokenWithGateway } from "types";
import { getReceivedAmount } from "utils/receipt";
import { applySlippage } from "utils/slippage";
import { type Address, isAddressEqual } from "viem";
import { useAccount } from "wagmi";

import { useEthereumWalletClient } from "./useEthereumWalletClient";
import { redeemRequestQueryKey } from "./useGetRedeemRequest";
import { redeemRequestsQueryKey } from "./useGetRedeemRequests";
import { maxWithdrawQueryKey } from "./useMaxWithdraw";
import {
  previewRedeemQueryKey,
  previewRedeemTokenOptions,
} from "./usePreviewRedeem";
import { redeemDelayOptions } from "./useRedeemDelay";
import { treasuryReservesQueryKey } from "./useTreasuryReserves";

export const useRedeem = function ({
  approveAmount,
  onEmitter,
  peggedToken,
  peggedTokenIn,
  slippage,
  tokenOut,
}: {
  approveAmount?: bigint;
  onEmitter?: (emitter: EventEmitter<RedeemEvents>) => void;
  peggedToken: TokenWithGateway;
  peggedTokenIn: bigint;
  slippage: number;
  tokenOut: Address;
}) {
  const { address: account } = useAccount();
  const { data: walletClient } = useEthereumWalletClient();
  const ensureConnectedTo = useEnsureConnectedTo();
  const { queryKey: nativeBalanceKey } = useNativeBalance(mainnet.id);
  const queryClient = useQueryClient();

  const updateNativeBalanceAfterReceipt = useUpdateNativeBalanceAfterReceipt(
    mainnet.id,
  );

  const requestQueryKey = redeemRequestQueryKey({
    address: account,
    chainId: mainnet.id,
    gatewayAddress: peggedToken.gatewayAddress,
  });

  const requestsQueryKey = redeemRequestsQueryKey({
    address: account,
    chainId: mainnet.id,
  });

  const allowanceKey = allowanceQueryKey({
    owner: account,
    spender: peggedToken.gatewayAddress,
    token: peggedToken,
  });

  const peggedTokenBalanceQueryKey = tokenBalanceQueryKey(peggedToken, account);

  const treasuryReservesKey = treasuryReservesQueryKey({
    chainId: mainnet.id,
    gatewayAddress: peggedToken.gatewayAddress,
  });

  const tokenOutBalanceQueryKey = tokenBalanceQueryKey(
    {
      address: tokenOut,
      chainId: mainnet.id,
    },
    account,
  );

  const maxWithdrawKey = maxWithdrawQueryKey({
    chainId: mainnet.id,
    gatewayAddress: peggedToken.gatewayAddress,
    tokenOut,
  });

  return useMutation({
    async mutationFn() {
      if (!account) {
        throw new Error("No account connected");
      }
      await ensureConnectedTo(mainnet.id);

      const [preview, hasDelay] = await Promise.all([
        queryClient.ensureQueryData(
          previewRedeemTokenOptions({
            chainId: mainnet.id,
            client: walletClient!,
            gatewayAddress: peggedToken.gatewayAddress,
            peggedTokenIn,
            tokenOut,
          }),
        ),
        queryClient
          .ensureQueryData(
            redeemDelayOptions({
              account,
              chainId: mainnet.id,
              client: walletClient,
              gatewayAddress: peggedToken.gatewayAddress,
              queryClient,
            }),
          )
          .then((redeemDelay) => redeemDelay > 0n),
      ]);
      const minAmountOut = applySlippage({ preview, slippage });

      const { emitter, promise } = redeem(walletClient!, {
        approveAmount,
        gatewayAddress: peggedToken.gatewayAddress,
        minAmountOut,
        peggedTokenIn,
        receiver: account,
        tokenOut,
      });

      onEmitter?.(emitter);

      if (!hasDelay) {
        // If the user is redeeming from the Gateway Vault where the PeggedToken is locked
        // the PeggedToken is burned from this vault, so no approval step is required.
        // We don't need these events
        emitter.on("approve-transaction-reverted", function (receipt) {
          queryClient.invalidateQueries({
            queryKey: allowanceKey,
          });
          updateNativeBalanceAfterReceipt(receipt);
        });
        emitter.on("approve-transaction-succeeded", function (receipt) {
          queryClient.invalidateQueries({
            queryKey: allowanceKey,
          });
          updateNativeBalanceAfterReceipt(receipt);
        });
      }

      emitter.on("redeem-transaction-reverted", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
      });

      emitter.on("redeem-transaction-succeeded", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);

        const actualAmount =
          getReceivedAmount({ account, logs: receipt.logs }) ?? preview;

        if (hasDelay) {
          // if there's a delay, the PeggedToken was burned from the Gateway vault
          // so the amount to redeem is reduced.
          queryClient.setQueryData(requestQueryKey, (old: [bigint, bigint]) => [
            old[0] - peggedTokenIn,
            old[1],
          ]);
        } else {
          // If there's no delay, the user is burning PeggedTokens from their wallet
          queryClient.setQueryData(
            peggedTokenBalanceQueryKey,
            (old: bigint) => old - peggedTokenIn,
          );
        }
        // In any case, the user ends up receiving the original tokens converted from the PeggedToken
        queryClient.setQueryData(
          tokenOutBalanceQueryKey,
          (old: bigint) => old + actualAmount,
        );
        // optimistically decrease treasury reserve for the redeemed token
        queryClient.setQueryData(
          treasuryReservesKey,
          (old: { amount: bigint; token: { address: Address } }[]) =>
            old?.map((reserve) =>
              isAddressEqual(reserve.token.address, tokenOut)
                ? { ...reserve, amount: reserve.amount - actualAmount }
                : reserve,
            ),
        );
        // optimistically decrease max withdraw for the redeemed token
        queryClient.setQueryData(
          maxWithdrawKey,
          (old: bigint) => old - actualAmount,
        );
      });

      return promise;
    },
    async onSettled() {
      if (!account || !walletClient) {
        return;
      }
      const hasDelay = await queryClient.ensureQueryData(
        redeemDelayOptions({
          account,
          chainId: mainnet.id,
          client: walletClient,
          gatewayAddress: peggedToken.gatewayAddress,
          queryClient,
        }),
      );
      if (hasDelay) {
        queryClient.invalidateQueries({
          queryKey: requestQueryKey,
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: allowanceKey,
        });
        queryClient.invalidateQueries({
          queryKey: peggedTokenBalanceQueryKey,
        });
      }
      queryClient.invalidateQueries({
        queryKey: nativeBalanceKey,
      });
      queryClient.invalidateQueries({
        queryKey: tokenOutBalanceQueryKey,
      });

      queryClient.invalidateQueries({
        queryKey: treasuryReservesKey,
      });
      queryClient.invalidateQueries({
        queryKey: maxWithdrawKey,
      });
      queryClient.invalidateQueries({
        queryKey: requestsQueryKey,
      });

      // Let's clear this query, as once the user inputs an amount
      // again, it has to be recalculated
      queryClient.removeQueries({
        queryKey: previewRedeemQueryKey({
          chainId: mainnet.id,
          gatewayAddress: peggedToken.gatewayAddress,
          peggedTokenIn,
          tokenOut,
        }),
      });
    },
  });
};
