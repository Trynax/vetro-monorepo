import { useQueries } from "@tanstack/react-query";
import { mainnet } from "networks/mainnet";
import { useMemo } from "react";
import type { Hash } from "viem";
import { useAccount } from "wagmi";

import { hasActivePosition } from "../../utils/borrowPosition";
import { useEthereumClient } from "../useEthereumClient";

import { positionInfoOptions } from "./usePositionInfo";

export type PositionData = {
  borrowAssets: bigint;
  collateral: bigint;
  healthFactor: bigint | undefined;
  liquidationPrice: bigint | null;
  ltv: bigint | null | undefined;
  marketId: Hash;
};

export const usePositionsData = function (marketIds: Hash[]) {
  const { address: account } = useAccount();
  const client = useEthereumClient();

  const positionQueries = useQueries({
    queries: marketIds.map((marketId) =>
      positionInfoOptions({
        account,
        chainId: mainnet.id,
        client: client!,
        marketId,
      }),
    ),
  });

  const data = useMemo(
    () =>
      marketIds.reduce<PositionData[]>(function (acc, marketId, i) {
        const position = positionQueries[i].data;

        if (hasActivePosition(position)) {
          acc.push({
            // can't spread (...position) because these are actually getters
            // as position is a class instance, and getters are not enumerated by spread
            borrowAssets: position.borrowAssets,
            collateral: position.collateral,
            healthFactor: position.healthFactor,
            liquidationPrice: position.liquidationPrice,
            ltv: position.ltv,
            marketId,
          });
        }

        return acc;
      }, []),
    [marketIds, positionQueries],
  );

  const isLoading = positionQueries.some((q) => q.isLoading);

  return { data, isLoading };
};
