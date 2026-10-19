import { isAddressValid } from "@vetro-protocol/core";
import { EventEmitter } from "events";
import { toPromiseEvent } from "to-promise-event";
import {
  type Address,
  type TransactionReceipt,
  type WalletClient,
  encodeFunctionData,
  isAddress,
  isAddressEqual,
  zeroAddress,
} from "viem";
import { waitForTransactionReceipt, writeContract } from "viem/actions";

import { stakingVaultAbi } from "../../abi/stakingVaultAbi.ts";
import type { ClaimWithdrawBatchEvents } from "../../types.ts";

export type ClaimWithdrawBatchParams = {
  receiver: Address;
  requestIds: readonly bigint[];
  vaultAddress: Address;
};

const canClaimWithdrawBatch = function ({
  client,
  receiver,
  requestIds,
  vaultAddress,
}: {
  client: WalletClient;
  receiver: Address;
  requestIds: readonly bigint[];
  vaultAddress: Address;
}): {
  canClaimWithdrawBatch: boolean;
  reason?: string;
} {
  if (!client) {
    return {
      canClaimWithdrawBatch: false,
      reason: "Client is not defined",
    };
  }
  if (!client.chain) {
    return {
      canClaimWithdrawBatch: false,
      reason: "Chain is not defined on wallet client",
    };
  }
  if (!client.account) {
    return {
      canClaimWithdrawBatch: false,
      reason: "Client must have an account",
    };
  }
  if (!isAddressValid(vaultAddress)) {
    return {
      canClaimWithdrawBatch: false,
      reason: "Invalid StakingVault address",
    };
  }

  if (!receiver || !isAddress(receiver)) {
    return {
      canClaimWithdrawBatch: false,
      reason: "Invalid receiver address",
    };
  }
  if (isAddressEqual(receiver, zeroAddress)) {
    return {
      canClaimWithdrawBatch: false,
      reason: "Receiver address cannot be zero address",
    };
  }

  if (!Array.isArray(requestIds)) {
    return {
      canClaimWithdrawBatch: false,
      reason: "Request IDs must be an array",
    };
  }
  if (requestIds.length === 0) {
    return {
      canClaimWithdrawBatch: false,
      reason: "Request IDs array cannot be empty",
    };
  }
  for (const requestId of requestIds) {
    if (typeof requestId !== "bigint") {
      return {
        canClaimWithdrawBatch: false,
        reason: "All request IDs must be bigints",
      };
    }
  }

  return { canClaimWithdrawBatch: true };
};

const runClaimWithdrawBatch = (
  walletClient: WalletClient,
  { receiver, requestIds, vaultAddress }: ClaimWithdrawBatchParams,
) =>
  async function (emitter: EventEmitter<ClaimWithdrawBatchEvents>) {
    try {
      const { canClaimWithdrawBatch: canClaimWithdrawBatchFlag, reason } =
        canClaimWithdrawBatch({
          client: walletClient,
          receiver,
          requestIds,
          vaultAddress,
        });

      if (!canClaimWithdrawBatchFlag) {
        emitter.emit("claim-withdraw-batch-failed-validation", reason!);
        return;
      }

      emitter.emit("pre-claim-withdraw-batch");

      const claimWithdrawBatchHash = await writeContract(walletClient, {
        abi: stakingVaultAbi,
        account: walletClient.account!,
        address: vaultAddress,
        args: [requestIds, receiver],
        chain: walletClient.chain,
        functionName: "claimWithdrawBatch",
      }).catch(function (error: Error) {
        emitter.emit("user-signing-claim-withdraw-batch-error", error);
      });

      if (!claimWithdrawBatchHash) {
        return;
      }

      emitter.emit("user-signed-claim-withdraw-batch", claimWithdrawBatchHash);

      const claimWithdrawBatchReceipt = await waitForTransactionReceipt(
        walletClient,
        {
          hash: claimWithdrawBatchHash,
        },
      ).catch(function (error: Error) {
        emitter.emit("claim-withdraw-batch-failed", error);
      });

      if (!claimWithdrawBatchReceipt) {
        return;
      }

      const claimWithdrawBatchEventMap: Record<
        TransactionReceipt["status"],
        keyof ClaimWithdrawBatchEvents
      > = {
        reverted: "claim-withdraw-batch-transaction-reverted",
        success: "claim-withdraw-batch-transaction-succeeded",
      };

      emitter.emit(
        claimWithdrawBatchEventMap[claimWithdrawBatchReceipt.status],
        claimWithdrawBatchReceipt,
      );
    } catch (error) {
      emitter.emit("unexpected-error", error as Error);
    } finally {
      emitter.emit("claim-withdraw-batch-settled");
    }
  };

export const claimWithdrawBatch = (
  ...args: Parameters<typeof runClaimWithdrawBatch>
) => toPromiseEvent<ClaimWithdrawBatchEvents>(runClaimWithdrawBatch(...args));

export const encodeClaimWithdrawBatch = ({
  receiver,
  requestIds,
}: Omit<ClaimWithdrawBatchParams, "vaultAddress">) =>
  encodeFunctionData({
    abi: stakingVaultAbi,
    args: [requestIds, receiver],
    functionName: "claimWithdrawBatch",
  });
