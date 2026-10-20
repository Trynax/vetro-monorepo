import { allowanceQueryKey } from "@hemilabs/react-hooks/useAllowance";
import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { type AccrualPosition, getChainAddresses } from "@morpho-org/blue-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupplyCollateralEvents } from "@vetro-protocol/morpho-blue-market";
import { supplyCollateral } from "@vetro-protocol/morpho-blue-market/actions";
import type { EventEmitter } from "events";
import { mainnet } from "networks/mainnet";
import type { Hash } from "viem";
import { useAccount } from "wagmi";

import { useEthereumWalletClient } from "../useEthereumWalletClient";

import { atRiskPositionsQueryKey } from "./useAtRiskPositions";
import { marketCollateralQueryKey } from "./useMarketCollateral";
import { morphoMarketOptions } from "./useMorphoMarket";
import { positionInfoQueryKey } from "./usePositionInfo";

export const useSupplyCollateral = function ({
  approveAmount,
  collateralAmount,
  marketId,
  onEmitter,
}: {
  approveAmount?: bigint;
  collateralAmount: bigint;
  marketId: Hash;
  onEmitter?: (emitter: EventEmitter<SupplyCollateralEvents>) => void;
}) {
  const { address: account } = useAccount();
  const { data: walletClient } = useEthereumWalletClient();
  const ensureConnectedTo = useEnsureConnectedTo();
  const queryClient = useQueryClient();
  const updateNativeBalanceAfterReceipt = useUpdateNativeBalanceAfterReceipt(
    mainnet.id,
  );

  return useMutation({
    async mutationFn() {
      if (!account) {
        throw new Error("No account connected");
      }

      await ensureConnectedTo(mainnet.id);

      const market = await queryClient.ensureQueryData(
        morphoMarketOptions({
          chainId: mainnet.id,
          client: walletClient!,
          marketId,
        }),
      );

      const morphoAddress = getChainAddresses(mainnet.id).blue;

      const collateralBalanceKey = tokenBalanceQueryKey(
        { address: market.params.collateralToken, chainId: mainnet.id },
        account,
      );

      const positionInfoKey = positionInfoQueryKey({
        account,
        chainId: mainnet.id,
        marketId,
      });

      const { emitter, promise } = supplyCollateral(walletClient!, {
        address: morphoAddress,
        amount: collateralAmount,
        approveAmount,
        marketId,
        onBehalf: account,
      });

      onEmitter?.(emitter);

      emitter.on("approve-transaction-reverted", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
      });
      emitter.on("approve-transaction-succeeded", function (receipt) {
        const allowanceKey = allowanceQueryKey({
          owner: account,
          spender: morphoAddress,
          token: {
            address: market.params.collateralToken,
            chainId: mainnet.id,
          },
        });

        updateNativeBalanceAfterReceipt(receipt);
        queryClient.invalidateQueries({ queryKey: allowanceKey });
      });
      emitter.on("supply-collateral-transaction-reverted", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
      });
      emitter.on("supply-collateral-transaction-succeeded", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
        // Remove collateral token from user's wallet
        queryClient.setQueryData(collateralBalanceKey, (old?: bigint) =>
          old !== undefined ? old - collateralAmount : old,
        );
        // Update position's collateral
        queryClient.setQueryData(
          positionInfoKey,
          (old: AccrualPosition | undefined) =>
            old?.supplyCollateral(collateralAmount),
        );
        // Update market's total collateral
        queryClient.setQueryData(
          marketCollateralQueryKey(marketId),
          (old?: bigint) => (old !== undefined ? old + collateralAmount : old),
        );
      });

      return promise;
    },
    onSettled() {
      const marketOptions = morphoMarketOptions({
        chainId: mainnet.id,
        client: walletClient,
        marketId,
      });
      // should be available in the cache since the mutation requires it
      const market = queryClient.getQueryData(marketOptions.queryKey);

      if (market) {
        const morphoAddress = getChainAddresses(mainnet.id).blue;

        queryClient.invalidateQueries({
          queryKey: allowanceQueryKey({
            owner: account,
            spender: morphoAddress,
            token: {
              address: market.params.collateralToken,
              chainId: mainnet.id,
            },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: tokenBalanceQueryKey(
            {
              address: market.params.collateralToken,
              chainId: mainnet.id,
            },
            account,
          ),
        });
      }

      queryClient.invalidateQueries({
        queryKey: positionInfoQueryKey({
          account,
          chainId: mainnet.id,
          marketId,
        }),
      });

      queryClient.invalidateQueries({
        queryKey: marketCollateralQueryKey(marketId),
      });

      queryClient.invalidateQueries({
        queryKey: atRiskPositionsQueryKey({
          account,
          chainId: mainnet.id,
        }),
      });
    },
  });
};
