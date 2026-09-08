import { allowanceQueryKey } from "@hemilabs/react-hooks/useAllowance";
import { useEnsureConnectedTo } from "@hemilabs/react-hooks/useEnsureConnectedTo";
import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import { useUpdateNativeBalanceAfterReceipt } from "@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt";
import { type AccrualPosition, getChainAddresses } from "@morpho-org/blue-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  morphoBlueAbi,
  type RepayAssetsEvents,
} from "@vetro-protocol/morpho-blue-market";
import { repayAssets } from "@vetro-protocol/morpho-blue-market/actions";
import type { EventEmitter } from "events";
import { parseEventLogs, type Hash } from "viem";
import { useAccount } from "wagmi";

import { useEthereumWalletClient } from "../useEthereumWalletClient";
import { useMainnet } from "../useMainnet";

import { atRiskPositionsQueryKey } from "./useAtRiskPositions";
import { type MarketData, marketDataQueryKey } from "./useMarketData";
import { morphoMarketOptions, morphoMarketQueryKey } from "./useMorphoMarket";
import { positionInfoQueryKey } from "./usePositionInfo";

export const useRepayAssets = function ({
  approveAmount,
  marketId,
  onEmitter,
  repayAmount,
  repayShares,
}: {
  approveAmount?: bigint;
  marketId: Hash;
  onEmitter?: (emitter: EventEmitter<RepayAssetsEvents>) => void;
  repayAmount: bigint;
  repayShares?: bigint;
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

      const morphoAddress = getChainAddresses(ethereumChain.id).morpho;

      const loanBalanceKey = tokenBalanceQueryKey(
        { address: market.params.loanToken, chainId: ethereumChain.id },
        account,
      );

      const allowanceKey = allowanceQueryKey({
        owner: account,
        spender: morphoAddress,
        token: {
          address: market.params.loanToken,
          chainId: ethereumChain.id,
        },
      });

      const positionInfoKey = positionInfoQueryKey({
        account,
        chainId: ethereumChain.id,
        marketId,
      });

      const { emitter, promise } = repayAssets(walletClient!, {
        address: morphoAddress,
        amount: repayAmount,
        approveAmount,
        marketId,
        onBehalf: account,
        shares: repayShares,
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

        const events = parseEventLogs({
          abi: morphoBlueAbi,
          eventName: "Repay",
          logs: receipt.logs,
        });
        const repayment = events[0]?.args ?? {
          assets: repayAmount,
          shares: repayShares ?? 0n,
        };

        // Decrease loan token balance
        queryClient.setQueryData(loanBalanceKey, (old?: bigint) =>
          old !== undefined ? old - repayment.assets : old,
        );
        // Update position's borrow
        queryClient.setQueryData(
          positionInfoKey,
          (old: AccrualPosition | undefined) =>
            old?.repay(repayment.assets, repayment.shares).position,
        );
        // Update market's liquidity and total borrow
        queryClient.setQueryData(
          marketDataQueryKey({
            chainId: ethereumChain.id,
            marketId,
          }),
          (old: MarketData | undefined) =>
            old
              ? {
                  ...old,
                  liquidity: old.liquidity + repayment.assets,
                  totalBorrowAssets: old.totalBorrowAssets - repayment.assets,
                }
              : old,
        );
      });

      return promise;
    },
    async onSettled() {
      const marketOptions = morphoMarketOptions({
        chainId: ethereumChain.id,
        client: walletClient,
        marketId,
      });
      const market = queryClient.getQueryData(marketOptions.queryKey);
      const morphoAddress = getChainAddresses(ethereumChain.id).morpho;

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
            { address: market.params.loanToken, chainId: ethereumChain.id },
            account,
          ),
        });

        queryClient.invalidateQueries({
          queryKey: allowanceQueryKey({
            owner: account,
            spender: morphoAddress,
            token: {
              address: market.params.loanToken,
              chainId: ethereumChain.id,
            },
          }),
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
        queryKey: marketDataQueryKey({
          chainId: ethereumChain.id,
          marketId,
        }),
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
