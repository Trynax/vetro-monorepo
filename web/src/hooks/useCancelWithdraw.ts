import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelWithdraw } from "@vetro-protocol/earn/actions";
import { mainnet } from "networks/mainnet";
import { exitTicketsQueryKey } from "pages/earn/hooks/useExitTickets";
import type { ExitTicket } from "pages/earn/types";
import { type CostBases, bumpCostBasis } from "utils/costBasis";
import { type Address, isAddressEqual } from "viem";
import { useAccount } from "wagmi";

import { costBasisQueryKey } from "./useCostBasis";
import { earnedAmountUsdQueryKey } from "./useEarnedAmountUsd";
import { useEthereumWalletClient } from "./useEthereumWalletClient";
import { poolDepositsQueryKey } from "./usePoolDeposits";
import { stakedBalanceQueryKey } from "./useStakedBalance";
import { stakedUsdQueryKey } from "./useStakedUsd";

type CancelWithdrawStatus = "cancelling" | "completed" | "failed";

type Params = {
  assets: bigint;
  onStatusChange: (status: CancelWithdrawStatus) => void;
  onTransactionHash?: (hash: string) => void;
  requestId: bigint;
  stakingVaultAddress: Address;
};

export const useCancelWithdraw = function ({
  assets,
  onStatusChange,
  onTransactionHash,
  requestId,
  stakingVaultAddress,
}: Params) {
  const { address: account } = useAccount();
  const { data: walletClient } = useEthereumWalletClient();
  const ensureConnectedTo = useEnsureConnectedTo();
  const queryClient = useQueryClient();
  const { queryKey: nativeBalanceKey } = useNativeBalance(mainnet.id);
  const updateNativeBalanceAfterReceipt = useUpdateNativeBalanceAfterReceipt(
    mainnet.id,
  );

  const sharesBalanceKey = tokenBalanceQueryKey(
    { address: stakingVaultAddress, chainId: mainnet.id },
    account,
  );

  const stakedKey = stakedBalanceQueryKey({
    account: account!,
    chainId: mainnet.id,
    stakingVaultAddress,
  });

  const poolDepositsKey = poolDepositsQueryKey({
    chainId: mainnet.id,
    stakingVaultAddress,
  });

  return useMutation({
    async mutationFn() {
      if (!account) {
        throw new Error("No account connected");
      }

      await ensureConnectedTo(mainnet.id);

      const { emitter, promise } = cancelWithdraw(walletClient!, {
        requestId,
        vaultAddress: stakingVaultAddress,
      });

      emitter.on("user-signed-cancel-withdraw", function (hash) {
        onTransactionHash?.(hash);
        onStatusChange("cancelling");
      });

      const markFailed = function () {
        onStatusChange("failed");
      };

      emitter.on("user-signing-cancel-withdraw-error", markFailed);
      emitter.on("cancel-withdraw-failed", markFailed);
      emitter.on("cancel-withdraw-failed-validation", markFailed);
      emitter.on("unexpected-error", markFailed);

      emitter.on("cancel-withdraw-transaction-reverted", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
        markFailed();
      });

      emitter.on("cancel-withdraw-transaction-succeeded", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
        onStatusChange("completed");

        // Optimistically remove ticket from cache.
        queryClient.setQueryData(
          exitTicketsQueryKey(account),
          (old: ExitTicket[] | undefined) =>
            (old ?? []).filter(
              (t) =>
                !isAddressEqual(t.stakingVaultAddress, stakingVaultAddress) ||
                t.requestId !== requestId.toString(),
            ),
        );

        // Optimistically add assets back to staked balance
        queryClient.setQueryData(stakedKey, (old: bigint | undefined) =>
          old !== undefined ? old + assets : old,
        );

        queryClient.setQueryData(
          costBasisQueryKey(account),
          (old: CostBases | undefined) =>
            bumpCostBasis({ assets, costBases: old, stakingVaultAddress }),
        );
        // Optimistically add assets back to pool deposits
        queryClient.setQueryData(poolDepositsKey, (old: bigint | undefined) =>
          old !== undefined ? old + assets : old,
        );
      });

      return promise;
    },
    async onSettled() {
      queryClient.invalidateQueries({
        queryKey: nativeBalanceKey,
      });

      // Refetch (not just invalidate) shares: it feeds useStakedBalance.
      await queryClient.refetchQueries({ queryKey: sharesBalanceKey });

      queryClient.invalidateQueries({
        queryKey: stakedKey,
      });

      queryClient.invalidateQueries({
        queryKey: stakedUsdQueryKey({
          account,
          chainId: mainnet.id,
          stakingVaultAddress,
        }),
      });

      queryClient.invalidateQueries({
        queryKey: earnedAmountUsdQueryKey({
          account,
          chainId: mainnet.id,
          stakingVaultAddress,
        }),
      });

      queryClient.invalidateQueries({
        queryKey: poolDepositsKey,
      });
    },
  });
};
