import { allowanceQueryKey } from "@hemilabs/react-hooks/useAllowance";
import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { type AccrualPosition, getChainAddresses } from "@morpho-org/blue-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RepayAssetsEvents } from "@vetro-protocol/morpho-blue-market";
import { repayAssets } from "@vetro-protocol/morpho-blue-market/actions";
import type { EventEmitter } from "events";
import { mainnet } from "networks/mainnet";
import type { Hash } from "viem";
import { useAccount } from "wagmi";

import { useEthereumWalletClient } from "../useEthereumWalletClient";

import { atRiskPositionsQueryKey } from "./useAtRiskPositions";
import { type MarketData, marketDataQueryKey } from "./useMarketData";
import { morphoMarketOptions, morphoMarketQueryKey } from "./useMorphoMarket";
import { positionInfoQueryKey } from "./usePositionInfo";

export const useRepayAssets = function ({
  marketId,
  onEmitter,
  repayAmount,
}: {
  marketId: Hash;
  onEmitter?: (emitter: EventEmitter<RepayAssetsEvents>) => void;
  repayAmount: bigint;
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

      const loanBalanceKey = tokenBalanceQueryKey(
        { address: market.params.loanToken, chainId: mainnet.id },
        account,
      );

      const allowanceKey = allowanceQueryKey({
        owner: account,
        spender: morphoAddress,
        token: {
          address: market.params.loanToken,
          chainId: mainnet.id,
        },
      });

      const positionInfoKey = positionInfoQueryKey({
        account,
        chainId: mainnet.id,
        marketId,
      });

      const { emitter, promise } = repayAssets(walletClient!, {
        address: morphoAddress,
        amount: repayAmount,
        marketId,
        onBehalf: account,
      });

      onEmitter?.(emitter);

      emitter.on("approve-transaction-reverted", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
      });
      emitter.on("approve-transaction-succeeded", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
        queryClient.invalidateQueries({ queryKey: allowanceKey });
      });
      emitter.on("repay-assets-transaction-reverted", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
      });
      emitter.on("repay-assets-transaction-succeeded", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
        // Decrease loan token balance
        queryClient.setQueryData(loanBalanceKey, (old?: bigint) =>
          old !== undefined ? old - repayAmount : old,
        );
        // Update position's borrow
        queryClient.setQueryData(
          positionInfoKey,
          (old: AccrualPosition | undefined) =>
            old?.repay(repayAmount, 0n).position,
        );
        // Update market's liquidity and total borrow
        queryClient.setQueryData(
          marketDataQueryKey({
            chainId: mainnet.id,
            marketId,
          }),
          (old: MarketData | undefined) =>
            old
              ? {
                  ...old,
                  liquidity: old.liquidity + repayAmount,
                  totalBorrowAssets: old.totalBorrowAssets - repayAmount,
                }
              : old,
        );
      });

      return promise;
    },
    async onSettled() {
      const marketOptions = morphoMarketOptions({
        chainId: mainnet.id,
        client: walletClient,
        marketId,
      });
      const market = queryClient.getQueryData(marketOptions.queryKey);
      const morphoAddress = getChainAddresses(mainnet.id).blue;

      // First invalidate the market data itself. Wait for invalidation, as useMarketData depends on it
      await queryClient.invalidateQueries({
        queryKey: morphoMarketQueryKey({
          chainId: mainnet.id,
          marketId,
        }),
      });

      if (market) {
        queryClient.invalidateQueries({
          queryKey: tokenBalanceQueryKey(
            { address: market.params.loanToken, chainId: mainnet.id },
            account,
          ),
        });

        queryClient.invalidateQueries({
          queryKey: allowanceQueryKey({
            owner: account,
            spender: morphoAddress,
            token: {
              address: market.params.loanToken,
              chainId: mainnet.id,
            },
          }),
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
        queryKey: marketDataQueryKey({
          chainId: mainnet.id,
          marketId,
        }),
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
