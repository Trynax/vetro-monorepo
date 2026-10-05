import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { claimWithdrawBatch } from "@vetro-protocol/earn/actions";
import { mainnet } from "networks/mainnet";
import { exitTicketsQueryKey } from "pages/earn/hooks/useExitTickets";
import type { ExitTicket } from "pages/earn/types";
import type { TokenWithGateway } from "types";
import { type Address, isAddressEqual } from "viem";
import { useAccount } from "wagmi";

import { useEthereumWalletClient } from "./useEthereumWalletClient";
import { stakedBalanceQueryKey } from "./useStakedBalance";
import { vaultPeggedTokenQueryOptions } from "./useVaultPeggedToken";

type ClaimWithdrawBatchStatus = "claiming" | "completed" | "failed";

type Withdrawal = {
  requestIds: bigint[];
  stakingVaultAddress: Address;
};

type Params = {
  onStatusChange: (args: {
    peggedToken: TokenWithGateway;
    stakingVaultAddress: Address;
    status: ClaimWithdrawBatchStatus;
  }) => void;
  // Fires once the whole batch claims without any vault failing: the mutationFn
  // throws on the first failure, so a successful settle means every vault is done.
  onSuccess?: VoidFunction;
  onTransactionHash?: (args: {
    hash: string;
    stakingVaultAddress: Address;
  }) => void;
};

export const useClaimWithdrawBatch = function ({
  onStatusChange,
  onSuccess,
  onTransactionHash,
}: Params) {
  const { address: account } = useAccount();
  const { data: walletClient } = useEthereumWalletClient();
  const ensureConnectedTo = useEnsureConnectedTo();
  const queryClient = useQueryClient();

  const { queryKey: nativeBalanceKey } = useNativeBalance(mainnet.id);
  const updateNativeBalanceAfterReceipt = useUpdateNativeBalanceAfterReceipt(
    mainnet.id,
  );

  return useMutation({
    async mutationFn(withdrawals: Withdrawal[]) {
      if (!account) {
        throw new Error("No account connected");
      }
      if (!walletClient) {
        throw new Error("No wallet client");
      }

      await ensureConnectedTo(mainnet.id);

      // One transaction per staking vault, run sequentially so the drawer can
      // reflect progress step by step and so each transaction lands as its own
      // activity entry.
      for (const { requestIds, stakingVaultAddress } of withdrawals) {
        // Resolve the vault's pegged token before claiming so every status
        // change (and the activity entry it drives) has the token metadata.
        const peggedToken = await queryClient.ensureQueryData(
          vaultPeggedTokenQueryOptions({
            client: walletClient,
            queryClient,
            stakingVaultAddress,
          }),
        );

        const { emitter, promise } = claimWithdrawBatch(walletClient, {
          receiver: account,
          requestIds,
          vaultAddress: stakingVaultAddress,
        });

        let failed = false;

        // The action never rejects: it funnels every failure through an event
        // and resolves the promise regardless. So each terminal failure must be
        // flagged here, otherwise the loop would treat the vault as successful,
        // advance to the next one, and report the whole batch as complete.
        const markFailed = function () {
          failed = true;
          onStatusChange({
            peggedToken,
            stakingVaultAddress,
            status: "failed",
          });
        };

        emitter.on("user-signed-claim-withdraw-batch", function (hash) {
          onTransactionHash?.({ hash, stakingVaultAddress });
          onStatusChange({
            peggedToken,
            stakingVaultAddress,
            status: "claiming",
          });
        });

        emitter.on("user-signing-claim-withdraw-batch-error", markFailed);
        emitter.on("claim-withdraw-batch-failed", markFailed);
        emitter.on("claim-withdraw-batch-failed-validation", markFailed);
        emitter.on("unexpected-error", markFailed);

        emitter.on(
          "claim-withdraw-batch-transaction-reverted",
          function (receipt) {
            updateNativeBalanceAfterReceipt(receipt);
            markFailed();
          },
        );

        emitter.on(
          "claim-withdraw-batch-transaction-succeeded",
          function (receipt) {
            updateNativeBalanceAfterReceipt(receipt);
            onStatusChange({
              peggedToken,
              stakingVaultAddress,
              status: "completed",
            });

            const requestIdStrings = requestIds.map((id) => id.toString());

            // Optimistically mark this vault's claimed tickets as withdrawn so
            // they leave the ready list even if a later vault fails.
            queryClient.setQueryData(
              exitTicketsQueryKey(account),
              (old: ExitTicket[] | undefined) =>
                (old ?? []).map((t) =>
                  isAddressEqual(t.stakingVaultAddress, stakingVaultAddress) &&
                  requestIdStrings.includes(t.requestId)
                    ? { ...t, claimTxHash: receipt.transactionHash }
                    : t,
                ),
            );
          },
        );

        await promise;

        // Stop the flow on failure so the user can retry the remaining vaults.
        if (failed) {
          throw new Error(
            `Claim withdraw batch failed for vault ${stakingVaultAddress}`,
          );
        }
      }
    },
    async onSettled(_data, _error, withdrawals) {
      queryClient.invalidateQueries({
        queryKey: nativeBalanceKey,
      });

      // Refetch (not just invalidate) each vault's shares balance: it feeds
      // useStakedBalance via ensureQueryData and has no mounted observer, so
      // invalidation alone would leave the staked balance recomputing from
      // stale shares.
      await Promise.all(
        withdrawals.map(({ stakingVaultAddress }) =>
          queryClient.refetchQueries({
            queryKey: tokenBalanceQueryKey(
              { address: stakingVaultAddress, chainId: mainnet.id },
              account,
            ),
          }),
        ),
      );

      withdrawals.forEach(({ stakingVaultAddress }) =>
        queryClient.invalidateQueries({
          queryKey: stakedBalanceQueryKey({
            account: account!,
            chainId: mainnet.id,
            stakingVaultAddress,
          }),
        }),
      );
    },
    onSuccess,
  });
};
