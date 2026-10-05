import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mainnet } from "networks/mainnet";
import type { TokenWithGateway } from "types";
import { type CostBases, reduceCostBasisProportionally } from "utils/costBasis";
import type { Address } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { withdraw } from "viem-erc4626/actions";
import { useAccount } from "wagmi";

import { costBasisQueryKey } from "./useCostBasis";
import { earnedAmountUsdQueryKey } from "./useEarnedAmountUsd";
import { useEthereumWalletClient } from "./useEthereumWalletClient";
import { poolDepositsQueryKey } from "./usePoolDeposits";
import { stakedBalanceQueryKey } from "./useStakedBalance";
import { stakedUsdQueryKey } from "./useStakedUsd";

type InstantWithdrawStatus = "completed" | "failed" | "withdrawing";

type Params = {
  assets: bigint;
  onStatusChange?: (status: InstantWithdrawStatus) => void;
  onSuccess?: VoidFunction;
  onTransactionHash?: (hash: string) => void;
  peggedToken: TokenWithGateway;
  stakingVaultAddress: Address;
};

export const useInstantWithdraw = function ({
  assets,
  onStatusChange,
  onSuccess,
  onTransactionHash,
  peggedToken,
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

  const peggedTokenBalanceKey = tokenBalanceQueryKey(peggedToken, account);

  const sharesBalanceKey = tokenBalanceQueryKey(
    { address: stakingVaultAddress, chainId: mainnet.id },
    account,
  );

  const stakedKey = stakedBalanceQueryKey({
    account: account!,
    chainId: mainnet.id,
    stakingVaultAddress,
  });

  const poolDepositsKey = poolDepositsQueryKey({
    chainId: mainnet.id,
    stakingVaultAddress,
  });

  return useMutation({
    async mutationFn() {
      if (!account) {
        throw new Error("No account connected");
      }

      await ensureConnectedTo(mainnet.id);

      const hash = await withdraw(walletClient!, {
        address: stakingVaultAddress,
        assets,
        owner: account,
        receiver: account,
      });

      onTransactionHash?.(hash);
      onStatusChange?.("withdrawing");

      const receipt = await waitForTransactionReceipt(walletClient!, {
        hash,
      });

      updateNativeBalanceAfterReceipt(receipt);

      if (receipt.status === "reverted") {
        onStatusChange?.("failed");
        return;
      }
      onStatusChange?.("completed");
      onSuccess?.();

      // Optimistically update balances
      queryClient.setQueryData(
        peggedTokenBalanceKey,
        (old: bigint | undefined) => (old !== undefined ? old + assets : old),
      );
      // Capture staked before the optimistic decrement so cost basis can be
      // reduced by the same proportion the subgraph applies on withdrawal.
      const stakedBefore = queryClient.getQueryData<bigint>(stakedKey);

      queryClient.setQueryData(stakedKey, (old: bigint | undefined) =>
        old !== undefined ? old - assets : old,
      );

      queryClient.setQueryData(
        costBasisQueryKey(account),
        (old: CostBases | undefined) =>
          reduceCostBasisProportionally({
            assets,
            costBases: old,
            stakedBefore,
            stakingVaultAddress,
          }),
      );
      queryClient.setQueryData(poolDepositsKey, (old: bigint | undefined) =>
        old !== undefined ? old - assets : old,
      );
    },
    onError() {
      onStatusChange?.("failed");
    },
    async onSettled() {
      queryClient.invalidateQueries({
        queryKey: nativeBalanceKey,
      });

      queryClient.invalidateQueries({
        queryKey: peggedTokenBalanceKey,
      });

      // Refetch (not just invalidate) shares: it feeds useStakedBalance.
      await queryClient.refetchQueries({ queryKey: sharesBalanceKey });

      queryClient.invalidateQueries({
        queryKey: stakedKey,
      });

      queryClient.invalidateQueries({
        queryKey: stakedUsdQueryKey({
          account,
          chainId: mainnet.id,
          stakingVaultAddress,
        }),
      });

      queryClient.invalidateQueries({
        queryKey: earnedAmountUsdQueryKey({
          account,
          chainId: mainnet.id,
          stakingVaultAddress,
        }),
      });

      queryClient.invalidateQueries({
        queryKey: poolDepositsKey,
      });
    },
  });
};
