import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { type AccrualPosition, getChainAddresses } from "@morpho-org/blue-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  morphoBlueAbi,
  type BorrowAssetsEvents,
} from "@vetro-protocol/morpho-blue-market";
import { borrowAssets } from "@vetro-protocol/morpho-blue-market/actions";
import type { EventEmitter } from "events";
import { mainnet } from "networks/mainnet";
import { parseEventLogs, type Hash } from "viem";
import { useAccount } from "wagmi";

import { useEthereumWalletClient } from "../useEthereumWalletClient";

import { atRiskPositionsQueryKey } from "./useAtRiskPositions";
import { type MarketData, marketDataQueryKey } from "./useMarketData";
import { morphoMarketOptions, morphoMarketQueryKey } from "./useMorphoMarket";
import { positionInfoQueryKey } from "./usePositionInfo";

export const useBorrowMoreAssets = function ({
  borrowAmount,
  marketId,
  onEmitter,
}: {
  borrowAmount: bigint;
  marketId: Hash;
  onEmitter?: (emitter: EventEmitter<BorrowAssetsEvents>) => void;
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

      const positionInfoKey = positionInfoQueryKey({
        account,
        chainId: mainnet.id,
        marketId,
      });

      const { emitter, promise } = borrowAssets(walletClient!, {
        address: morphoAddress,
        amount: borrowAmount,
        marketId,
        onBehalf: account,
        receiver: account,
      });

      onEmitter?.(emitter);

      emitter.on("borrow-assets-transaction-reverted", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);
      });
      emitter.on("borrow-assets-transaction-succeeded", function (receipt) {
        updateNativeBalanceAfterReceipt(receipt);

        const events = parseEventLogs({
          abi: morphoBlueAbi,
          eventName: "Borrow",
          logs: receipt.logs,
        });
        if (events.length > 0) {
          const { assets } = events[0].args;
          // Add borrowed assets to loan token balance
          queryClient.setQueryData(
            loanBalanceKey,
            (old?: bigint) => (old ?? 0n) + assets,
          );
          // Update position's borrow
          queryClient.setQueryData(
            positionInfoKey,
            (old: AccrualPosition | undefined) =>
              old?.borrow(assets, 0n).position,
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
                    liquidity: old.liquidity - assets,
                    totalBorrowAssets: old.totalBorrowAssets + assets,
                  }
                : old,
          );
        }
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
