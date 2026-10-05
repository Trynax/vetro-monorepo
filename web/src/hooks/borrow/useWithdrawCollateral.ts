import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { type AccrualPosition, getChainAddresses } from "@morpho-org/blue-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WithdrawCollateralEvents } from "@vetro-protocol/morpho-blue-market";
import { withdrawCollateral } from "@vetro-protocol/morpho-blue-market/actions";
import type { EventEmitter } from "events";
import type { Hash } from "viem";
import { useAccount } from "wagmi";

import { useEthereumWalletClient } from "../useEthereumWalletClient";
import { useMainnet } from "../useMainnet";

import { atRiskPositionsQueryKey } from "./useAtRiskPositions";
import { marketCollateralQueryKey } from "./useMarketCollateral";
import { morphoMarketOptions, morphoMarketQueryKey } from "./useMorphoMarket";
import { positionInfoQueryKey } from "./usePositionInfo";

export const useWithdrawCollateral = function ({
  collateralAmount,
  marketId,
  onEmitter,
}: {
  collateralAmount: bigint;
  marketId: Hash;
  onEmitter?: (emitter: EventEmitter<WithdrawCollateralEvents>) => void;
}) {
  const { address: account } = useAccount();
  const { data: walletClient } = useEthereumWalletClient();
  const ensureConnectedTo = useEnsureConnectedTo();
  const ethereumChain = useMainnet();
  const queryClient = useQueryClient();
  const updateNativeBalanceAfterReceipt = useUpdateNativeBalanceAfterReceipt(
    ethereumChain.id,
  );

  return useMutation({
    async mutationFn() {
      if (!account) {
        throw new Error("No account connected");
      }

      await ensureConnectedTo(ethereumChain.id);

      const market = await queryClient.ensureQueryData(
        morphoMarketOptions({
          chainId: ethereumChain.id,
          client: walletClient!,
          marketId,
        }),
      );

      const morphoAddress = getChainAddresses(ethereumChain.id).blue;

      const collateralBalanceKey = tokenBalanceQueryKey(
        { address: market.params.collateralToken, chainId: ethereumChain.id },
        account,
      );

      const positionInfoKey = positionInfoQueryKey({
        account,
        chainId: ethereumChain.id,
        marketId,
      });

      const { emitter, promise } = withdrawCollateral(walletClient!, {
        address: morphoAddress,
        amount: collateralAmount,
        marketId,
        onBehalf: account,
        receiver: account,
      });

      onEmitter?.(emitter);

      emitter.on(
        "withdraw-collateral-transaction-reverted",
        function (receipt) {
          updateNativeBalanceAfterReceipt(receipt);
        },
      );
      emitter.on(
        "withdraw-collateral-transaction-succeeded",
        function (receipt) {
          updateNativeBalanceAfterReceipt(receipt);
          // Add collateral back to user's wallet
          queryClient.setQueryData(collateralBalanceKey, (old?: bigint) =>
            old !== undefined ? old + collateralAmount : old,
          );
          // Update position's collateral
          queryClient.setQueryData(
            positionInfoKey,
            (old: AccrualPosition | undefined) =>
              old?.withdrawCollateral(collateralAmount),
          );
          // Decrease market total collateral
          queryClient.setQueryData(
            marketCollateralQueryKey(marketId),
            (old?: bigint) =>
              old !== undefined ? old - collateralAmount : old,
          );
        },
      );

      return promise;
    },
    async onSettled() {
      const marketOptions = morphoMarketOptions({
        chainId: ethereumChain.id,
        client: walletClient,
        marketId,
      });
      const market = queryClient.getQueryData(marketOptions.queryKey);

      // First invalidate the market data itself. Wait for invalidation, as useMarketData depends on it
      await queryClient.invalidateQueries({
        queryKey: morphoMarketQueryKey({
          chainId: ethereumChain.id,
          marketId,
        }),
      });

      if (market) {
        queryClient.invalidateQueries({
          queryKey: tokenBalanceQueryKey(
            {
              address: market.params.collateralToken,
              chainId: ethereumChain.id,
            },
            account,
          ),
        });
      }

      queryClient.invalidateQueries({
        queryKey: positionInfoQueryKey({
          account,
          chainId: ethereumChain.id,
          marketId,
        }),
      });

      queryClient.invalidateQueries({
        queryKey: marketCollateralQueryKey(marketId),
      });

      queryClient.invalidateQueries({
        queryKey: atRiskPositionsQueryKey({
          account,
          chainId: ethereumChain.id,
        }),
      });
    },
  });
};
