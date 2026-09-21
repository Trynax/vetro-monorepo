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
import { allowance, approve } from "viem-erc20/actions";

import { stakingVaultAbi } from "../../abi/stakingVaultAbi.ts";
import type { DepositEvents } from "../../types.ts";

export type DepositParams = {
  approveAmount?: bigint;
  assets: bigint;
  receiver: Address;
  token: Address;
  vaultAddress: Address;
};

const canDeposit = function ({
  approveAmount,
  assets,
  client,
  receiver,
  token,
  vaultAddress,
}: {
  approveAmount: bigint;
  assets: bigint;
  client: WalletClient;
  receiver: Address;
  token: Address;
  vaultAddress: Address;
}): {
  canDeposit: boolean;
  reason?: string;
} {
  if (!client) {
    return {
      canDeposit: false,
      reason: "Client is not defined",
    };
  }
  if (!client.chain) {
    return {
      canDeposit: false,
      reason: "Chain is not defined on wallet client",
    };
  }
  if (!client.account) {
    return {
      canDeposit: false,
      reason: "Client must have an account",
    };
  }
  if (!isAddressValid(vaultAddress)) {
    return {
      canDeposit: false,
      reason: "Invalid StakingVault address",
    };
  }
  if (!token || !isAddress(token)) {
    return {
      canDeposit: false,
      reason: "Invalid token address",
    };
  }
  if (isAddressEqual(token, zeroAddress)) {
    return {
      canDeposit: false,
      reason: "Token address cannot be zero address",
    };
  }

  if (!receiver || !isAddress(receiver)) {
    return {
      canDeposit: false,
      reason: "Invalid receiver address",
    };
  }
  if (isAddressEqual(receiver, zeroAddress)) {
    return {
      canDeposit: false,
      reason: "Receiver address cannot be zero address",
    };
  }

  if (typeof assets !== "bigint") {
    return {
      canDeposit: false,
      reason: "Assets must be a bigint",
    };
  }
  if (assets <= 0n) {
    return {
      canDeposit: false,
      reason: "Assets must be greater than 0",
    };
  }

  if (approveAmount < assets) {
    return {
      canDeposit: false,
      reason: "Approve amount must be greater than or equal to assets",
    };
  }

  return { canDeposit: true };
};

const runDeposit = (walletClient: WalletClient, params: DepositParams) =>
  async function (emitter: EventEmitter<DepositEvents>) {
    const { assets, receiver, token, vaultAddress } = params;
    const approveAmount = params.approveAmount ?? assets;

    try {
      const { canDeposit: canDepositFlag, reason } = canDeposit({
        approveAmount,
        assets,
        client: walletClient,
        receiver,
        token,
        vaultAddress,
      });

      if (!canDepositFlag) {
        emitter.emit("deposit-failed-validation", reason!);
        return;
      }

      const currentAllowance = await allowance(walletClient, {
        address: token,
        owner: walletClient.account!.address,
        spender: vaultAddress,
      });

      if (currentAllowance < assets) {
        emitter.emit("pre-approve");

        const approvalHash = await approve(walletClient, {
          address: token,
          amount: approveAmount,
          spender: vaultAddress,
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
          emitter.emit("deposit-failed", error);
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

      emitter.emit("pre-deposit");

      const depositHash = await writeContract(walletClient, {
        abi: stakingVaultAbi,
        account: walletClient.account!,
        address: vaultAddress,
        args: [assets, receiver],
        chain: walletClient.chain,
        functionName: "deposit",
      }).catch(function (error: Error) {
        emitter.emit("user-signing-deposit-error", error);
      });

      if (!depositHash) {
        return;
      }

      emitter.emit("user-signed-deposit", depositHash);

      const depositReceipt = await waitForTransactionReceipt(walletClient, {
        hash: depositHash,
      }).catch(function (error: Error) {
        emitter.emit("deposit-failed", error);
      });

      if (!depositReceipt) {
        return;
      }

      const depositEventMap: Record<
        TransactionReceipt["status"],
        keyof DepositEvents
      > = {
        reverted: "deposit-transaction-reverted",
        success: "deposit-transaction-succeeded",
      };

      emitter.emit(depositEventMap[depositReceipt.status], depositReceipt);
    } catch (error) {
      emitter.emit("unexpected-error", error as Error);
    } finally {
      emitter.emit("deposit-settled");
    }
  };

export const deposit = (...args: Parameters<typeof runDeposit>) =>
  toPromiseEvent<DepositEvents>(runDeposit(...args));

export const encodeDeposit = ({ assets, receiver }: DepositParams) =>
  encodeFunctionData({
    abi: stakingVaultAbi,
    args: [assets, receiver],
    functionName: "deposit",
  });
