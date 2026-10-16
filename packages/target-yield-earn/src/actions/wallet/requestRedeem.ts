import { isAddressValid } from "@vetro-protocol/core";
import { EventEmitter } from "events";
import { toPromiseEvent } from "to-promise-event";
import { type Address, type TransactionReceipt, type WalletClient } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { requestRedeem as erc7540RequestRedeem } from "viem-erc7540/actions";

import type { RequestRedeemEvents } from "../../types.ts";

export type RequestRedeemParams = {
  address: Address;
  controller: Address;
  owner: Address;
  shares: bigint;
};

const canRequestRedeem = function ({
  address,
  client,
  controller,
  owner,
  shares,
}: {
  address: Address;
  client: WalletClient;
  controller: Address;
  owner: Address;
  shares: bigint;
}): {
  canRequestRedeem: boolean;
  reason?: string;
} {
  if (!client) {
    return {
      canRequestRedeem: false,
      reason: "Client is not defined",
    };
  }
  if (!client.chain) {
    return {
      canRequestRedeem: false,
      reason: "Chain is not defined on wallet client",
    };
  }
  if (!client.account) {
    return {
      canRequestRedeem: false,
      reason: "Client must have an account",
    };
  }
  if (!isAddressValid(address)) {
    return {
      canRequestRedeem: false,
      reason: "Invalid vault address",
    };
  }
  if (!isAddressValid(controller)) {
    return {
      canRequestRedeem: false,
      reason: "Invalid controller address",
    };
  }
  if (!isAddressValid(owner)) {
    return {
      canRequestRedeem: false,
      reason: "Invalid owner address",
    };
  }
  if (typeof shares !== "bigint") {
    return {
      canRequestRedeem: false,
      reason: "Shares must be a bigint",
    };
  }
  if (shares <= 0n) {
    return {
      canRequestRedeem: false,
      reason: "Shares must be greater than 0",
    };
  }

  return { canRequestRedeem: true };
};

const runRequestRedeem = (
  walletClient: WalletClient,
  params: RequestRedeemParams,
) =>
  async function (emitter: EventEmitter<RequestRedeemEvents>) {
    try {
      const { address, controller, owner, shares } = params;

      const { canRequestRedeem: canRequestRedeemFlag, reason } =
        canRequestRedeem({
          address,
          client: walletClient,
          controller,
          owner,
          shares,
        });

      if (!canRequestRedeemFlag) {
        emitter.emit("request-redeem-failed-validation", reason!);
        return;
      }

      emitter.emit("pre-request-redeem");

      const requestRedeemHash = await erc7540RequestRedeem(walletClient, {
        address,
        controller,
        owner,
        shares,
      }).catch(function (error: Error) {
        emitter.emit("user-signing-request-redeem-error", error);
      });

      if (!requestRedeemHash) {
        return;
      }

      emitter.emit("user-signed-request-redeem", requestRedeemHash);

      const requestRedeemReceipt = await waitForTransactionReceipt(
        walletClient,
        {
          hash: requestRedeemHash,
        },
      ).catch(function (error: Error) {
        emitter.emit("request-redeem-failed", error);
      });

      if (!requestRedeemReceipt) {
        return;
      }

      const requestRedeemEventMap: Record<
        TransactionReceipt["status"],
        keyof RequestRedeemEvents
      > = {
        reverted: "request-redeem-transaction-reverted",
        success: "request-redeem-transaction-succeeded",
      };

      emitter.emit(
        requestRedeemEventMap[requestRedeemReceipt.status],
        requestRedeemReceipt,
      );
    } catch (error) {
      emitter.emit("unexpected-error", error as Error);
    } finally {
      emitter.emit("request-redeem-settled");
    }
  };

export const requestRedeem = (...args: Parameters<typeof runRequestRedeem>) =>
  toPromiseEvent<RequestRedeemEvents>(runRequestRedeem(...args));
