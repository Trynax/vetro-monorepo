import { isAddressValid } from "@vetro-protocol/core";
import { EventEmitter } from "events";
import { toPromiseEvent } from "to-promise-event";
import {
  type Address,
  isAddressEqual,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import {
  allowance,
  approve,
  asset,
  requestDeposit as erc7540RequestDeposit,
} from "viem-erc7540/actions";

import type { RequestDepositEvents } from "../../types.ts";

export type RequestDepositParams = {
  address: Address;
  approveAmount?: bigint;
  assets: bigint;
  controller: Address;
  owner?: Address;
};

const canRequestDeposit = function ({
  address,
  approveAmount,
  assets,
  client,
  controller,
  owner,
}: {
  address: Address;
  approveAmount: bigint;
  assets: bigint;
  client: WalletClient;
  controller: Address;
  owner?: Address;
}): {
  canRequestDeposit: boolean;
  reason?: string;
} {
  if (!client) {
    return {
      canRequestDeposit: false,
      reason: "Client is not defined",
    };
  }
  if (!client.chain) {
    return {
      canRequestDeposit: false,
      reason: "Chain is not defined on wallet client",
    };
  }
  if (!client.account) {
    return {
      canRequestDeposit: false,
      reason: "Client must have an account",
    };
  }
  if (!isAddressValid(address)) {
    return {
      canRequestDeposit: false,
      reason: "Invalid vault address",
    };
  }
  if (!isAddressValid(controller)) {
    return {
      canRequestDeposit: false,
      reason: "Invalid controller address",
    };
  }
  if (owner !== undefined && !isAddressValid(owner)) {
    return {
      canRequestDeposit: false,
      reason: "Invalid owner address",
    };
  }
  if (typeof assets !== "bigint") {
    return {
      canRequestDeposit: false,
      reason: "Assets must be a bigint",
    };
  }
  if (assets <= 0n) {
    return {
      canRequestDeposit: false,
      reason: "Assets must be greater than 0",
    };
  }
  if (approveAmount < assets) {
    return {
      canRequestDeposit: false,
      reason: "Approve amount must be greater than or equal to assets",
    };
  }

  return { canRequestDeposit: true };
};

const runRequestDeposit = (
  walletClient: WalletClient,
  params: RequestDepositParams,
) =>
  async function (emitter: EventEmitter<RequestDepositEvents>) {
    try {
      const { address, assets, controller } = params;
      const approveAmount = params.approveAmount ?? assets;

      const { canRequestDeposit: canRequestDepositFlag, reason } =
        canRequestDeposit({
          address,
          approveAmount,
          assets,
          client: walletClient,
          controller,
          owner: params.owner,
        });

      if (!canRequestDepositFlag) {
        emitter.emit("request-deposit-failed-validation", reason!);
        return;
      }

      const account = walletClient.account!.address;
      const owner = params.owner ?? account;

      const token = await asset(walletClient, { address });

      const currentAllowance = await allowance(walletClient, {
        address: token,
        owner,
        spender: address,
      });

      if (currentAllowance < assets) {
        if (!isAddressEqual(owner, account)) {
          emitter.emit(
            "request-deposit-failed-validation",
            "Owner allowance is lower than assets",
          );
          return;
        }

        emitter.emit("pre-approve");

        const approvalHash = await approve(walletClient, {
          address: token,
          amount: approveAmount,
          spender: address,
        }).catch(function (error: Error) {
          emitter.emit("user-signing-approval-error", error);
        });

        if (!approvalHash) {
          return;
        }

        emitter.emit("user-signed-approval", approvalHash);

        const approvalReceipt = await waitForTransactionReceipt(walletClient, {
          hash: approvalHash,
        }).catch(function (error: Error) {
          emitter.emit("request-deposit-failed", error);
        });

        if (!approvalReceipt) {
          return;
        }

        if (approvalReceipt.status === "reverted") {
          emitter.emit("approve-transaction-reverted", approvalReceipt);
          return;
        }

        emitter.emit("approve-transaction-succeeded", approvalReceipt);
      }

      emitter.emit("pre-request-deposit");

      const requestDepositHash = await erc7540RequestDeposit(walletClient, {
        address,
        assets,
        controller,
        owner,
      }).catch(function (error: Error) {
        emitter.emit("user-signing-request-deposit-error", error);
      });

      if (!requestDepositHash) {
        return;
      }

      emitter.emit("user-signed-request-deposit", requestDepositHash);

      const requestDepositReceipt = await waitForTransactionReceipt(
        walletClient,
        {
          hash: requestDepositHash,
        },
      ).catch(function (error: Error) {
        emitter.emit("request-deposit-failed", error);
      });

      if (!requestDepositReceipt) {
        return;
      }

      const requestDepositEventMap: Record<
        TransactionReceipt["status"],
        keyof RequestDepositEvents
      > = {
        reverted: "request-deposit-transaction-reverted",
        success: "request-deposit-transaction-succeeded",
      };

      emitter.emit(
        requestDepositEventMap[requestDepositReceipt.status],
        requestDepositReceipt,
      );
    } catch (error) {
      emitter.emit("unexpected-error", error as Error);
    } finally {
      emitter.emit("request-deposit-settled");
    }
  };

export const requestDeposit = (...args: Parameters<typeof runRequestDeposit>) =>
  toPromiseEvent<RequestDepositEvents>(runRequestDeposit(...args));
