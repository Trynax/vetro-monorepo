import { isAddressValid } from "@vetro-protocol/core";
import { EventEmitter } from "events";
import { toPromiseEvent } from "to-promise-event";
import {
  type Address,
  encodeFunctionData,
  isAddressEqual,
  maxUint256,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "viem/actions";
import { maxDeposit } from "viem-erc7540/actions";

import { targetYieldEarnVaultAbi } from "../../abi/targetYieldEarnVaultAbi.ts";
import type { ClaimDepositEvents } from "../../types.ts";
import { getIsShutdown } from "../public/getIsShutdown.ts";

export type ClaimDepositParams = {
  address: Address;
  assets: bigint;
  controller: Address;
  receiver?: Address;
};

const canClaimDeposit = async function ({
  address,
  assets,
  client,
  controller,
  receiver,
}: {
  address: Address;
  assets: bigint;
  client: WalletClient;
  controller: Address;
  receiver?: Address;
}): Promise<{
  canClaimDeposit: boolean;
  reason?: string;
}> {
  if (!client) {
    return {
      canClaimDeposit: false,
      reason: "Client is not defined",
    };
  }
  if (!client.chain) {
    return {
      canClaimDeposit: false,
      reason: "Chain is not defined on wallet client",
    };
  }
  if (!client.account) {
    return {
      canClaimDeposit: false,
      reason: "Client must have an account",
    };
  }
  if (!isAddressValid(address)) {
    return {
      canClaimDeposit: false,
      reason: "Invalid vault address",
    };
  }
  if (!isAddressValid(controller)) {
    return {
      canClaimDeposit: false,
      reason: "Invalid controller address",
    };
  }
  if (receiver !== undefined && !isAddressValid(receiver)) {
    return {
      canClaimDeposit: false,
      reason: "Invalid receiver address",
    };
  }
  if (typeof assets !== "bigint") {
    return {
      canClaimDeposit: false,
      reason: "Assets must be a bigint",
    };
  }
  if (assets <= 0n) {
    return {
      canClaimDeposit: false,
      reason: "Assets must be greater than 0",
    };
  }

  const account = client.account.address;
  const [isShutdown, isAuthorized, claimableAssets] = await Promise.all([
    getIsShutdown(client, { address }),
    isAddressEqual(account, controller) ||
      readContract(client, {
        abi: targetYieldEarnVaultAbi,
        address,
        args: [controller, account],
        functionName: "isOperator",
      }),
    maxDeposit(client, { address, receiver: controller }),
  ]);

  if (isShutdown) {
    return {
      canClaimDeposit: false,
      reason: "Vault is shut down",
    };
  }
  if (!isAuthorized) {
    return {
      canClaimDeposit: false,
      reason: "Account is not the controller or its operator",
    };
  }
  if (claimableAssets === 0n) {
    return {
      canClaimDeposit: false,
      reason: "No claimable deposit",
    };
  }
  if (assets !== maxUint256 && assets > claimableAssets) {
    return {
      canClaimDeposit: false,
      reason: "Assets exceed the claimable deposit",
    };
  }

  return { canClaimDeposit: true };
};

const getDepositArgs = ({
  assets,
  controller,
  receiver = controller,
}: ClaimDepositParams) => [assets, receiver, controller] as const;

const runClaimDeposit = (
  walletClient: WalletClient,
  params: ClaimDepositParams,
) =>
  async function (emitter: EventEmitter<ClaimDepositEvents>) {
    try {
      const { address, assets, controller, receiver } = params;
      const { canClaimDeposit: canClaimDepositFlag, reason } =
        await canClaimDeposit({
          address,
          assets,
          client: walletClient,
          controller,
          receiver,
        });

      if (!canClaimDepositFlag) {
        emitter.emit("claim-deposit-failed-validation", reason!);
        return;
      }

      emitter.emit("pre-claim-deposit");

      const claimDepositHash = await writeContract(walletClient, {
        abi: targetYieldEarnVaultAbi,
        account: walletClient.account!,
        address,
        args: getDepositArgs(params),
        chain: walletClient.chain,
        functionName: "deposit",
      }).catch(function (error: Error) {
        emitter.emit("user-signing-claim-deposit-error", error);
      });

      if (!claimDepositHash) {
        return;
      }

      emitter.emit("user-signed-claim-deposit", claimDepositHash);

      const claimDepositReceipt = await waitForTransactionReceipt(
        walletClient,
        {
          hash: claimDepositHash,
        },
      ).catch(function (error: Error) {
        emitter.emit("claim-deposit-failed", error);
      });

      if (!claimDepositReceipt) {
        return;
      }

      const claimDepositEventMap: Record<
        TransactionReceipt["status"],
        keyof ClaimDepositEvents
      > = {
        reverted: "claim-deposit-transaction-reverted",
        success: "claim-deposit-transaction-succeeded",
      };

      emitter.emit(
        claimDepositEventMap[claimDepositReceipt.status],
        claimDepositReceipt,
      );
    } catch (error) {
      emitter.emit("unexpected-error", error as Error);
    } finally {
      emitter.emit("claim-deposit-settled");
    }
  };

export const claimDeposit = (...args: Parameters<typeof runClaimDeposit>) =>
  toPromiseEvent<ClaimDepositEvents>(runClaimDeposit(...args));

export const encodeClaimDeposit = (params: ClaimDepositParams) =>
  encodeFunctionData({
    abi: targetYieldEarnVaultAbi,
    args: getDepositArgs(params),
    functionName: "deposit",
  });
