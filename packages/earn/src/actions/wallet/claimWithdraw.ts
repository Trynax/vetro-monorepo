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
import type { ClaimWithdrawEvents } from "../../types.ts";

export type ClaimWithdrawParams = {
  receiver: Address;
  requestId: bigint;
  vaultAddress: Address;
};

const canClaimWithdraw = function ({
  client,
  receiver,
  requestId,
  vaultAddress,
}: {
  client: WalletClient;
  receiver: Address;
  requestId: bigint;
  vaultAddress: Address;
}): {
  canClaimWithdraw: boolean;
  reason?: string;
} {
  if (!client) {
    return {
      canClaimWithdraw: false,
      reason: "Client is not defined",
    };
  }
  if (!client.chain) {
    return {
      canClaimWithdraw: false,
      reason: "Chain is not defined on wallet client",
    };
  }
  if (!client.account) {
    return {
      canClaimWithdraw: false,
      reason: "Client must have an account",
    };
  }
  if (!isAddressValid(vaultAddress)) {
    return {
      canClaimWithdraw: false,
      reason: "Invalid StakingVault address",
    };
  }

  if (!receiver || !isAddress(receiver)) {
    return {
      canClaimWithdraw: false,
      reason: "Invalid receiver address",
    };
  }
  if (isAddressEqual(receiver, zeroAddress)) {
    return {
      canClaimWithdraw: false,
      reason: "Receiver address cannot be zero address",
    };
  }

  if (typeof requestId !== "bigint") {
    return {
      canClaimWithdraw: false,
      reason: "Request ID must be a bigint",
    };
  }

  return { canClaimWithdraw: true };
};

const runClaimWithdraw = (
  walletClient: WalletClient,
  { receiver, requestId, vaultAddress }: ClaimWithdrawParams,
) =>
  async function (emitter: EventEmitter<ClaimWithdrawEvents>) {
    try {
      const { canClaimWithdraw: canClaimWithdrawFlag, reason } =
        canClaimWithdraw({
          client: walletClient,
          receiver,
          requestId,
          vaultAddress,
        });

      if (!canClaimWithdrawFlag) {
        emitter.emit("claim-withdraw-failed-validation", reason!);
        return;
      }

      emitter.emit("pre-claim-withdraw");

      const claimWithdrawHash = await writeContract(walletClient, {
        abi: stakingVaultAbi,
        account: walletClient.account!,
        address: vaultAddress,
        args: [requestId, receiver],
        chain: walletClient.chain,
        functionName: "claimWithdraw",
      }).catch(function (error: Error) {
        emitter.emit("user-signing-claim-withdraw-error", error);
      });

      if (!claimWithdrawHash) {
        return;
      }

      emitter.emit("user-signed-claim-withdraw", claimWithdrawHash);

      const claimWithdrawReceipt = await waitForTransactionReceipt(
        walletClient,
        {
          hash: claimWithdrawHash,
        },
      ).catch(function (error: Error) {
        emitter.emit("claim-withdraw-failed", error);
      });

      if (!claimWithdrawReceipt) {
        return;
      }

      const claimWithdrawEventMap: Record<
        TransactionReceipt["status"],
        keyof ClaimWithdrawEvents
      > = {
        reverted: "claim-withdraw-transaction-reverted",
        success: "claim-withdraw-transaction-succeeded",
      };

      emitter.emit(
        claimWithdrawEventMap[claimWithdrawReceipt.status],
        claimWithdrawReceipt,
      );
    } catch (error) {
      emitter.emit("unexpected-error", error as Error);
    } finally {
      emitter.emit("claim-withdraw-settled");
    }
  };

export const claimWithdraw = (...args: Parameters<typeof runClaimWithdraw>) =>
  toPromiseEvent<ClaimWithdrawEvents>(runClaimWithdraw(...args));

export const encodeClaimWithdraw = ({
  receiver,
  requestId,
}: Omit<ClaimWithdrawParams, "vaultAddress">) =>
  encodeFunctionData({
    abi: stakingVaultAbi,
    args: [requestId, receiver],
    functionName: "claimWithdraw",
  });
