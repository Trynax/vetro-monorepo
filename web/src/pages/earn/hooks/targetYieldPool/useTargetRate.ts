import {
  type UseQueryOptions,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";
import { fetchTargetRate } from "fetchers/earn/targetYieldPool/fetchTargetRate";
import type { Address } from "viem";

import { combineWithEpochId } from "./combineWithEpochId";
import { useEpochId } from "./useEpochId";

type QueryOptions<TSelect = bigint> = Omit<
  UseQueryOptions<bigint, Error, TSelect>,
  "enabled" | "queryFn" | "queryKey"
>;

export const targetRateOptions = <TSelect = bigint>({
  epochId,
  stakingVaultAddress,
  ...options
}: {
  epochId: bigint | undefined;
  stakingVaultAddress: Address;
} & QueryOptions<TSelect>) =>
  queryOptions({
    ...options,
    enabled: epochId !== undefined,
    queryFn: () => fetchTargetRate(epochId!),
    queryKey: [
      "target-yield-pool-target-rate",
      stakingVaultAddress,
      epochId?.toString(),
    ],
  });

export function useTargetRate(stakingVaultAddress: Address) {
  const epochId = useEpochId(stakingVaultAddress);
  const query = useQuery(
    targetRateOptions({ epochId: epochId.data, stakingVaultAddress }),
  );

  return combineWithEpochId({ epochId, query });
}
