import { isAddressValid } from "@vetro-protocol/core";
import { EventEmitter } from "events";
import { toPromiseEvent } from "to-promise-event";
import {
  type Address,
  type Hash,
  type TransactionReceipt,
  type WalletClient,
  encodeFunctionData,
  zeroHash,
} from "viem";
import { waitForTransactionReceipt, writeContract } from "viem/actions";
import { allowance, approve } from "viem-erc20/actions";

import { morphoBlueAbi } from "../../abi/morphoBlueAbi.ts";
import type { MarketParams, RepayAssetsEvents } from "../../types.ts";
import { getMarketParams } from "../public/getMarketParams.ts";

export type RepayAssetsParams = {
  address: Address;
  amount: bigint;
  approveAmount?: bigint;
  marketId: Hash;
  onBehalf: Address;
  shares?: bigint;
};

const canRepayAssets = function ({
  address,
  amount,
  approveAmount,
  client,
  marketId,
  onBehalf,
  shares,
}: {
  address: Address;
  amount: bigint;
  approveAmount: bigint;
  client: WalletClient;
  marketId: Hash;
  onBehalf: Address;
  shares?: bigint;
}): {
  canRepayAssets: boolean;
  reason?: string;
} {
  if (!client) {
    return {
      canRepayAssets: false,
      reason: "Client is not defined",
    };
  }
  if (!client.chain) {
    return {
      canRepayAssets: false,
      reason: "Chain is not defined on wallet client",
    };
  }
  if (!client.account) {
    return {
      canRepayAssets: false,
      reason: "Client must have an account",
    };
  }
  if (!isAddressValid(address)) {
    return {
      canRepayAssets: false,
      reason: "Invalid Morpho address",
    };
  }
  if (!marketId || marketId === zeroHash) {
    return {
      canRepayAssets: false,
      reason: "Market ID cannot be empty or zero",
    };
  }
  if (!isAddressValid(onBehalf)) {
    return {
      canRepayAssets: false,
      reason: "Invalid onBehalf address",
    };
  }
  if (typeof amount !== "bigint") {
    return {
      canRepayAssets: false,
      reason: "Amount must be a bigint",
    };
  }
  if (amount <= 0n) {
    return {
      canRepayAssets: false,
      reason: "Amount must be greater than 0",
    };
  }
  if (typeof approveAmount !== "bigint") {
    return {
      canRepayAssets: false,
      reason: "Approve amount must be a bigint",
    };
  }
  if (approveAmount < amount) {
    return {
      canRepayAssets: false,
      reason: "Approve amount must be greater than or equal to amount",
    };
  }
  if (shares !== undefined && typeof shares !== "bigint") {
    return {
      canRepayAssets: false,
      reason: "Shares must be a bigint",
    };
  }
  if (shares !== undefined && shares <= 0n) {
    return {
      canRepayAssets: false,
      reason: "Shares must be greater than 0",
    };
  }

  return { canRepayAssets: true };
};

const runRepayAssets = (
  walletClient: WalletClient,
  {
    address,
    amount,
    approveAmount = amount,
    marketId,
    onBehalf,
    shares,
  }: RepayAssetsParams,
) =>
  async function (emitter: EventEmitter<RepayAssetsEvents>) {
    try {
      const { canRepayAssets: canRepayAssetsFlag, reason } = canRepayAssets({
        address,
        amount,
        approveAmount,
        client: walletClient,
        marketId,
        onBehalf,
        shares,
      });

      if (!canRepayAssetsFlag) {
        emitter.emit("repay-assets-failed-validation", reason!);
        return;
      }

      const marketParams = await getMarketParams({
        address,
        client: walletClient,
        marketId,
      });

      const currentAllowance = await allowance(walletClient, {
        address: marketParams.loanToken,
        owner: walletClient.account!.address,
        spender: address,
      });

      const requiredAllowance = shares === undefined ? amount : approveAmount;

      if (currentAllowance < requiredAllowance) {
        emitter.emit("pre-approve");

        const approvalHash = await approve(walletClient, {
          address: marketParams.loanToken,
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
          emitter.emit("repay-assets-failed", error);
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

      emitter.emit("pre-repay-assets");

      const repayHash = await writeContract(walletClient, {
        abi: morphoBlueAbi,
        account: walletClient.account!,
        address,
        args: [
          marketParams,
          shares === undefined ? amount : 0n,
          shares ?? 0n,
          onBehalf,
          "0x",
        ],
        chain: walletClient.chain,
        functionName: "repay",
      }).catch(function (error: Error) {
        emitter.emit("user-signing-repay-assets-error", error);
      });

      if (!repayHash) {
        return;
      }

      emitter.emit("user-signed-repay-assets", repayHash);

      const repayReceipt = await waitForTransactionReceipt(walletClient, {
        hash: repayHash,
      }).catch(function (error: Error) {
        emitter.emit("repay-assets-failed", error);
      });

      if (!repayReceipt) {
        return;
      }

      const repayEventMap: Record<
        TransactionReceipt["status"],
        keyof RepayAssetsEvents
      > = {
        reverted: "repay-assets-transaction-reverted",
        success: "repay-assets-transaction-succeeded",
      };

      emitter.emit(repayEventMap[repayReceipt.status], repayReceipt);
    } catch (error) {
      emitter.emit("unexpected-error", error as Error);
    } finally {
      emitter.emit("repay-assets-settled");
    }
  };

export const repayAssets = (...args: Parameters<typeof runRepayAssets>) =>
  toPromiseEvent<RepayAssetsEvents>(runRepayAssets(...args));

export const encodeRepayAssets = ({
  amount,
  marketParams,
  onBehalf,
  shares,
}: {
  amount: bigint;
  marketParams: MarketParams;
  onBehalf: Address;
  shares?: bigint;
}) =>
  encodeFunctionData({
    abi: morphoBlueAbi,
    args: [
      marketParams,
      shares === undefined ? amount : 0n,
      shares ?? 0n,
      onBehalf,
      "0x",
    ],
    functionName: "repay",
  });
