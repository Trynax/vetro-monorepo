import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { claimWithdraw } from "@vetro-protocol/earn/actions";
import { mainnet } from "networks/mainnet";
import { exitTicketsQueryKey } from "pages/earn/hooks/useExitTickets";
import type { ExitTicket } from "pages/earn/types";
import { type Address, isAddressEqual } from "viem";
import { useAccount } from "wagmi";

import { useEthereumWalletClient } from "./useEthereumWalletClient";
import { stakedBalanceQueryKey } from "./useStakedBalance";

type ClaimWithdrawStatus = "claiming" | "completed" | "failed";

type Params = {
  onStatusChange: (status: ClaimWithdrawStatus) => void;
  onTransactionHash?: (hash: string) => void;
  requestId: bigint;
  stakingVaultAddress: Address;
};

export const useClaimWithdraw = function ({
  onStatusChange,
  onTransactionHash,
  requestId,
  stakingVaultAddress,
}: Params) {
  const { address: account } = useAccount();
  const { data: walletClient } = useEthereumWalletClient();
  const ensureConnectedTo = useEnsureConnectedTo();
  const queryClient = useQueryClient();

  const { queryKey: nativeBalanceKey } = useNativeBalance(mainnet.id);
  const updateNativeBalanceAfterReceipt = useUpdateNativeBalanceAfterReceipt(
    mainnet.id,
  );

  const sharesBalanceKey = tokenBalanceQueryKey(
    { address: stakingVaultAddress, chainId: mainnet.id },
    account,
  );

  const stakedKey = stakedBalanceQueryKey({
    account: account!,
    chainId: mainnet.id,
    stakingVaultAddress,
  });

  return useMutation({
    async mutationFn() {
      if (!account) {
        throw new Error("No account connected");
      }

      await ensureConnectedTo(mainnet.id);

      const { emitter, promise } = claimWithdraw(walletClient!, {
        receiver: account,
        requestId,
        vaultAddress: stakingVaultAddress,
      });

      emitter.on("user-signed-claim-withdraw", function (hash) {
        onTransactionHash?.(hash);
        onStatusChange("claiming");
      });

      const markFailed = function () {
        onStatusChange("failed");
      };

      emitter.on("user-signing-claim-withdraw-error", markFailed);
      emitter.on("claim-withdraw-failed", markFailed);
      emitter.on("claim-withdraw-failed-validation", markFailed);
      emitter.on("unexpected-error", markFailed);

      emitter.on("claim-withdraw-transaction-reverted", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
        markFailed();
      });

      emitter.on("claim-withdraw-transaction-succeeded", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
        onStatusChange("completed");

        // Optimistically mark ticket as withdrawn by setting claimTxHash.
        queryClient.setQueryData(
          exitTicketsQueryKey(account),
          (old: ExitTicket[] | undefined) =>
            (old ?? []).map((t) =>
              isAddressEqual(t.stakingVaultAddress, stakingVaultAddress) &&
              t.requestId === requestId.toString()
                ? { ...t, claimTxHash: receipt.transactionHash }
                : t,
            ),
        );
      });

      return promise;
    },
    async onSettled() {
      queryClient.invalidateQueries({
        queryKey: nativeBalanceKey,
      });

      await queryClient.invalidateQueries({
        queryKey: sharesBalanceKey,
      });

      queryClient.invalidateQueries({
        queryKey: stakedKey,
      });
    },
  });
};
