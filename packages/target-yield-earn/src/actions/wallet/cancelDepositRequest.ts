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

import { targetYieldEarnVaultAbi } from "../../abi/targetYieldEarnVaultAbi.ts";
import type { CancelDepositRequestEvents } from "../../types.ts";

export type CancelDepositRequestParams = {
  address: Address;
  controller: Address;
};

const canCancelDepositRequest = function ({
  address,
  client,
  controller,
}: {
  address: Address;
  client: WalletClient;
  controller: Address;
}): {
  canCancelDepositRequest: boolean;
  reason?: string;
} {
  if (!client) {
    return {
      canCancelDepositRequest: false,
      reason: "Client is not defined",
    };
  }
  if (!client.chain) {
    return {
      canCancelDepositRequest: false,
      reason: "Chain is not defined on wallet client",
    };
  }
  if (!client.account) {
    return {
      canCancelDepositRequest: false,
      reason: "Client must have an account",
    };
  }
  if (!isAddressValid(address)) {
    return {
      canCancelDepositRequest: false,
      reason: "Invalid vault address",
    };
  }
  if (!isAddressValid(controller)) {
    return {
      canCancelDepositRequest: false,
      reason: "Invalid controller address",
    };
  }

  return { canCancelDepositRequest: true };
};

const runCancelDepositRequest = (
  walletClient: WalletClient,
  params: CancelDepositRequestParams,
) =>
  async function (emitter: EventEmitter<CancelDepositRequestEvents>) {
    try {
      const { address, controller } = params;

      const { canCancelDepositRequest: canCancelDepositRequestFlag, reason } =
        canCancelDepositRequest({
          address,
          client: walletClient,
          controller,
        });

      if (!canCancelDepositRequestFlag) {
        emitter.emit("cancel-deposit-request-failed-validation", reason!);
        return;
      }

      emitter.emit("pre-cancel-deposit-request");

      const cancelDepositRequestHash = await writeContract(walletClient, {
        abi: targetYieldEarnVaultAbi,
        account: walletClient.account!,
        address,
        args: [controller],
        chain: walletClient.chain,
        functionName: "cancelDepositRequest",
      }).catch(function (error: Error) {
        emitter.emit("user-signing-cancel-deposit-request-error", error);
      });

      if (!cancelDepositRequestHash) {
        return;
      }

      emitter.emit(
        "user-signed-cancel-deposit-request",
        cancelDepositRequestHash,
      );

      const cancelDepositRequestReceipt = await waitForTransactionReceipt(
        walletClient,
        {
          hash: cancelDepositRequestHash,
        },
      ).catch(function (error: Error) {
        emitter.emit("cancel-deposit-request-failed", error);
      });

      if (!cancelDepositRequestReceipt) {
        return;
      }

      const cancelDepositRequestEventMap: Record<
        TransactionReceipt["status"],
        keyof CancelDepositRequestEvents
      > = {
        reverted: "cancel-deposit-request-transaction-reverted",
        success: "cancel-deposit-request-transaction-succeeded",
      };

      emitter.emit(
        cancelDepositRequestEventMap[cancelDepositRequestReceipt.status],
        cancelDepositRequestReceipt,
      );
    } catch (error) {
      emitter.emit("unexpected-error", error as Error);
    } finally {
      emitter.emit("cancel-deposit-request-settled");
    }
  };

export const cancelDepositRequest = (
  ...args: Parameters<typeof runCancelDepositRequest>
) =>
  toPromiseEvent<CancelDepositRequestEvents>(runCancelDepositRequest(...args));

export const encodeCancelDepositRequest = ({
  controller,
}: CancelDepositRequestParams) =>
  encodeFunctionData({
    abi: targetYieldEarnVaultAbi,
    args: [controller],
    functionName: "cancelDepositRequest",
  });
