import { allowanceQueryKey } from "@hemilabs/react-hooks/useAllowance";
import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deposit } from "@vetro-protocol/earn/actions";
import { useRef } from "react";
import type { TokenWithGateway } from "types";
import { type CostBases, bumpCostBasis } from "utils/costBasis";
import type { Address, TransactionReceipt } from "viem";
import { useAccount } from "wagmi";

import { costBasisQueryKey } from "./useCostBasis";
import { earnedAmountUsdQueryKey } from "./useEarnedAmountUsd";
import { useEthereumWalletClient } from "./useEthereumWalletClient";
import { useMainnet } from "./useMainnet";
import { poolDepositsQueryKey } from "./usePoolDeposits";
import { stakedBalanceQueryKey } from "./useStakedBalance";
import { stakedUsdQueryKey } from "./useStakedUsd";

type DepositStatus =
  | "approve-failed"
  | "approve-unknown"
  | "approved"
  | "approving"
  | "completed"
  | "deposit-failed"
  | "deposit-unknown"
  | "depositing";

function getDepositFailureStatus({
  currentStep,
  submittedStep,
}: {
  currentStep: "approve" | "deposit";
  submittedStep: "approve" | "deposit" | undefined;
}): DepositStatus {
  if (submittedStep === "approve") {
    return "approve-unknown";
  }
  if (submittedStep === "deposit") {
    return "deposit-unknown";
  }
  return currentStep === "approve" ? "approve-failed" : "deposit-failed";
}

type Params = {
  approveAmount?: bigint;
  assets: bigint;
  needsApproval: boolean;
  onStatusChange?: (status: DepositStatus) => void;
  onSuccess?: VoidFunction;
  onTransactionHash?: (hash: string) => void;
  peggedToken: TokenWithGateway;
  stakingVaultAddress: Address;
};

export const useStakeDeposit = function ({
  approveAmount,
  assets,
  needsApproval,
  onStatusChange,
  onSuccess,
  onTransactionHash,
  peggedToken,
  stakingVaultAddress,
}: Params) {
  const { address: account } = useAccount();
  const chain = useMainnet();
  const { data: walletClient } = useEthereumWalletClient();
  const ensureConnectedTo = useEnsureConnectedTo();
  const queryClient = useQueryClient();
  const currentStep = useRef<"approve" | "deposit">("deposit");
  const submittedStep = useRef<"approve" | "deposit" | undefined>(undefined);
  const { queryKey: nativeBalanceKey } = useNativeBalance(chain.id);
  const updateNativeBalanceAfterReceipt = useUpdateNativeBalanceAfterReceipt(
    chain.id,
  );

  const allowanceKey = allowanceQueryKey({
    owner: account,
    spender: stakingVaultAddress,
    token: { address: peggedToken.address, chainId: chain.id },
  });

  const peggedTokenBalanceKey = tokenBalanceQueryKey(peggedToken, account);

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
      if (submittedStep.current) {
        throw new Error("Previous transaction outcome is unknown");
      }

      currentStep.current = needsApproval ? "approve" : "deposit";
      await ensureConnectedTo(chain.id);

      const { emitter, promise } = deposit(walletClient!, {
        approveAmount,
        assets,
        receiver: account,
        token: peggedToken.address,
        vaultAddress: stakingVaultAddress,
      });

      emitter.on("user-signed-approval", function () {
        currentStep.current = "approve";
        submittedStep.current = "approve";
        onStatusChange?.("approving");
      });

      emitter.on("pre-approve", function () {
        currentStep.current = "approve";
      });

      emitter.on("approve-transaction-succeeded", function () {
        onStatusChange?.("approved");
      });

      emitter.on("user-signed-deposit", function (hash) {
        currentStep.current = "deposit";
        onTransactionHash?.(hash);
        onStatusChange?.("depositing");
      });

      emitter.on("pre-deposit", function () {
        currentStep.current = "deposit";
      });

      emitter.on("user-signing-approval-error", function () {
        onStatusChange?.("approve-failed");
      });

      emitter.on(
        "approve-transaction-reverted",
        function (receipt: TransactionReceipt) {
          submittedStep.current = undefined;
          updateNativeBalanceAfterReceipt(receipt);
          onStatusChange?.("approve-failed");
        },
      );

      emitter.on("approve-transaction-unknown", function () {
        onStatusChange?.("approve-unknown");
      });

      emitter.on(
        "approve-transaction-succeeded",
        function (receipt: TransactionReceipt) {
          submittedStep.current = undefined;
          updateNativeBalanceAfterReceipt(receipt);
          queryClient.invalidateQueries({
            queryKey: allowanceKey,
          });
        },
      );

      emitter.on("deposit-failed", function () {
        onStatusChange?.(
          getDepositFailureStatus({
            currentStep: currentStep.current,
            submittedStep: submittedStep.current,
          }),
        );
      });

      emitter.on("deposit-failed-validation", function () {
        onStatusChange?.("deposit-failed");
      });

      emitter.on("unexpected-error", function () {
        onStatusChange?.(
          getDepositFailureStatus({
            currentStep: currentStep.current,
            submittedStep: submittedStep.current,
          }),
        );
      });

      emitter.on("user-signing-deposit-error", function () {
        onStatusChange?.("deposit-failed");
      });

      emitter.on("deposit-transaction-unknown", function () {
        onStatusChange?.("deposit-unknown");
      });

      emitter.on(
        "deposit-transaction-reverted",
        function (receipt: TransactionReceipt) {
          submittedStep.current = undefined;
          updateNativeBalanceAfterReceipt(receipt);
          onStatusChange?.("deposit-failed");
        },
      );

      emitter.on(
        "deposit-transaction-succeeded",
        function (receipt: TransactionReceipt) {
          submittedStep.current = undefined;
          updateNativeBalanceAfterReceipt(receipt);
          onStatusChange?.("completed");
          onSuccess?.();

          // Optimistically update balances
          queryClient.setQueryData(
            peggedTokenBalanceKey,
            (old: bigint | undefined) =>
              old !== undefined ? old - assets : old,
          );
          queryClient.setQueryData(stakedKey, (old: bigint | undefined) =>
            old !== undefined ? old + assets : old,
          );
          queryClient.setQueryData(
            poolDepositsKey,
            (old: bigint | undefined) =>
              old !== undefined ? old + assets : old,
          );

          queryClient.setQueryData(
            costBasisQueryKey(account),
            (old: CostBases | undefined) =>
              bumpCostBasis({ assets, costBases: old, stakingVaultAddress }),
          );
        },
      );

      return promise;
    },
    onError() {
      onStatusChange?.(
        getDepositFailureStatus({
          currentStep: currentStep.current,
          submittedStep: submittedStep.current,
        }),
      );
    },
    async onSettled() {
      queryClient.invalidateQueries({
        queryKey: allowanceKey,
      });

      queryClient.invalidateQueries({
        queryKey: nativeBalanceKey,
      });

      queryClient.invalidateQueries({
        queryKey: peggedTokenBalanceKey,
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
