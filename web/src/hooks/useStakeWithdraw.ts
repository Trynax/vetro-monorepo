import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { stakingVaultAbi } from "@vetro-protocol/earn";
import { requestWithdraw } from "@vetro-protocol/earn/actions";
import { exitTicketsQueryKey } from "pages/earn/hooks/useExitTickets";
import type { ExitTicket } from "pages/earn/types";
import { type CostBases, reduceCostBasisProportionally } from "utils/costBasis";
import { type Address, type TransactionReceipt, parseEventLogs } from "viem";
import { useAccount } from "wagmi";

import { costBasisQueryKey } from "./useCostBasis";
import { earnedAmountUsdQueryKey } from "./useEarnedAmountUsd";
import { useEthereumWalletClient } from "./useEthereumWalletClient";
import { useMainnet } from "./useMainnet";
import { poolDepositsQueryKey } from "./usePoolDeposits";
import { stakedBalanceQueryKey } from "./useStakedBalance";
import { stakedUsdQueryKey } from "./useStakedUsd";

type WithdrawStatus = "completed" | "request-failed" | "requesting";

type Params = {
  assets: bigint;
  onStatusChange?: (status: WithdrawStatus) => void;
  onSuccess?: VoidFunction;
  onTransactionHash?: (hash: string) => void;
  stakingVaultAddress: Address;
};

export const useStakeWithdraw = function ({
  assets,
  onStatusChange,
  onSuccess,
  onTransactionHash,
  stakingVaultAddress,
}: Params) {
  const { address: account } = useAccount();
  const chain = useMainnet();
  const { data: walletClient } = useEthereumWalletClient();
  const ensureConnectedTo = useEnsureConnectedTo();
  const queryClient = useQueryClient();

  const { queryKey: nativeBalanceKey } = useNativeBalance(chain.id);
  const updateNativeBalanceAfterReceipt = useUpdateNativeBalanceAfterReceipt(
    chain.id,
  );

  const sharesBalanceKey = tokenBalanceQueryKey(
    { address: stakingVaultAddress, chainId: chain.id },
    account,
  );

  const stakedKey = stakedBalanceQueryKey({
    account: account!,
    chainId: chain.id,
    stakingVaultAddress,
  });

  const poolDepositsKey = poolDepositsQueryKey({
    chainId: chain.id,
    stakingVaultAddress,
  });

  return useMutation({
    async mutationFn() {
      if (!account) {
        throw new Error("No account connected");
      }
      if (!walletClient) {
        throw new Error("No wallet client available");
      }

      await ensureConnectedTo(chain.id);

      const { emitter, promise } = requestWithdraw(walletClient, {
        assets,
        owner: account,
        vaultAddress: stakingVaultAddress,
      });

      emitter.on("user-signed-request-withdraw", function (hash) {
        onTransactionHash?.(hash);
        onStatusChange?.("requesting");
      });

      emitter.on("user-signing-request-withdraw-error", function () {
        onStatusChange?.("request-failed");
      });

      emitter.on("request-withdraw-failed", function () {
        onStatusChange?.("request-failed");
      });

      emitter.on("request-withdraw-failed-validation", function () {
        onStatusChange?.("request-failed");
      });

      emitter.on("unexpected-error", function () {
        onStatusChange?.("request-failed");
      });

      emitter.on(
        "request-withdraw-transaction-reverted",
        function (receipt: TransactionReceipt) {
          updateNativeBalanceAfterReceipt(receipt);
          onStatusChange?.("request-failed");
        },
      );

      emitter.on(
        "request-withdraw-transaction-succeeded",
        function (receipt: TransactionReceipt) {
          updateNativeBalanceAfterReceipt(receipt);
          onStatusChange?.("completed");
          onSuccess?.();

          const stakedBefore = queryClient.getQueryData<bigint>(stakedKey);

          // Optimistically update staked balance
          queryClient.setQueryData(stakedKey, (old: bigint | undefined) =>
            old !== undefined ? old - assets : old,
          );
          queryClient.setQueryData(
            costBasisQueryKey(account),
            (old: CostBases | undefined) =>
              reduceCostBasisProportionally({
                assets,
                costBases: old,
                stakedBefore,
                stakingVaultAddress,
              }),
          );
          // Optimistically update pool deposits balance
          queryClient.setQueryData(
            poolDepositsKey,
            (old: bigint | undefined) =>
              old !== undefined ? old - assets : old,
          );

          // Optimistically add exit ticket to cache
          const logs = parseEventLogs({
            abi: stakingVaultAbi,
            eventName: "WithdrawRequested",
            logs: receipt.logs,
          });

          if (logs.length > 0) {
            const { args } = logs[0];
            const ticket: ExitTicket = {
              assets: args.assets.toString(),
              claimableAt: args.claimableAt.toString(),
              owner: args.owner,
              requestId: args.requestId.toString(),
              requestTxHash: receipt.transactionHash,
              shares: args.shares.toString(),
              stakingVaultAddress,
            };

            queryClient.setQueryData(
              exitTicketsQueryKey(account),
              (old: ExitTicket[] | undefined) => [ticket, ...(old ?? [])],
            );
          }
        },
      );

      return promise;
    },
    onError() {
      onStatusChange?.("request-failed");
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
          chainId: chain.id,
          stakingVaultAddress,
        }),
      });

      queryClient.invalidateQueries({
        queryKey: earnedAmountUsdQueryKey({
          account,
          chainId: chain.id,
          stakingVaultAddress,
        }),
      });

      queryClient.invalidateQueries({
        queryKey: poolDepositsKey,
      });
    },
  });
};
