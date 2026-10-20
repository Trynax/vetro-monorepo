import { isAddressValid } from "@vetro-protocol/core";
import { EventEmitter } from "events";
import { toPromiseEvent } from "to-promise-event";
import {
  type Address,
  type TransactionReceipt,
  type WalletClient,
  encodeFunctionData,
} from "viem";
import { waitForTransactionReceipt, writeContract } from "viem/actions";

import { stakingVaultAbi } from "../../abi/stakingVaultAbi.ts";
import type { CancelWithdrawEvents } from "../../types.ts";

export type CancelWithdrawParams = {
  requestId: bigint;
  vaultAddress: Address;
};

const canCancelWithdraw = function ({
  client,
  requestId,
  vaultAddress,
}: {
  client: WalletClient;
  requestId: bigint;
  vaultAddress: Address;
}): {
  canCancelWithdraw: boolean;
  reason?: string;
} {
  if (!client) {
    return {
      canCancelWithdraw: false,
      reason: "Client is not defined",
    };
  }
  if (!client.chain) {
    return {
      canCancelWithdraw: false,
      reason: "Chain is not defined on wallet client",
    };
  }
  if (!client.account) {
    return {
      canCancelWithdraw: false,
      reason: "Client must have an account",
    };
  }
  if (!isAddressValid(vaultAddress)) {
    return {
      canCancelWithdraw: false,
      reason: "Invalid StakingVault address",
    };
  }

  if (typeof requestId !== "bigint") {
    return {
      canCancelWithdraw: false,
      reason: "Request ID must be a bigint",
    };
  }

  return { canCancelWithdraw: true };
};

const runCancelWithdraw = (
  walletClient: WalletClient,
  { requestId, vaultAddress }: CancelWithdrawParams,
) =>
  async function (emitter: EventEmitter<CancelWithdrawEvents>) {
    try {
      const { canCancelWithdraw: canCancelWithdrawFlag, reason } =
        canCancelWithdraw({
          client: walletClient,
          requestId,
          vaultAddress,
        });

      if (!canCancelWithdrawFlag) {
        emitter.emit("cancel-withdraw-failed-validation", reason!);
        return;
      }

      emitter.emit("pre-cancel-withdraw");

      const cancelWithdrawHash = await writeContract(walletClient, {
        abi: stakingVaultAbi,
        account: walletClient.account!,
        address: vaultAddress,
        args: [requestId],
        chain: walletClient.chain,
        functionName: "cancelWithdraw",
      }).catch(function (error: Error) {
        emitter.emit("user-signing-cancel-withdraw-error", error);
      });

      if (!cancelWithdrawHash) {
        return;
      }

      emitter.emit("user-signed-cancel-withdraw", cancelWithdrawHash);

      const cancelWithdrawReceipt = await waitForTransactionReceipt(
        walletClient,
        {
          hash: cancelWithdrawHash,
        },
      ).catch(function (error: Error) {
        emitter.emit("cancel-withdraw-failed", error);
      });

      if (!cancelWithdrawReceipt) {
        return;
      }

      const cancelWithdrawEventMap: Record<
        TransactionReceipt["status"],
        keyof CancelWithdrawEvents
      > = {
        reverted: "cancel-withdraw-transaction-reverted",
        success: "cancel-withdraw-transaction-succeeded",
      };

      emitter.emit(
        cancelWithdrawEventMap[cancelWithdrawReceipt.status],
        cancelWithdrawReceipt,
      );
    } catch (error) {
      emitter.emit("unexpected-error", error as Error);
    } finally {
      emitter.emit("cancel-withdraw-settled");
    }
  };

export const cancelWithdraw = (...args: Parameters<typeof runCancelWithdraw>) =>
  toPromiseEvent<CancelWithdrawEvents>(runCancelWithdraw(...args));

export const encodeCancelWithdraw = ({
  requestId,
}: Omit<CancelWithdrawParams, "vaultAddress">) =>
  encodeFunctionData({
    abi: stakingVaultAbi,
    args: [requestId],
    functionName: "cancelWithdraw",
  });
