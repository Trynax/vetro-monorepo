import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchTargetRate } from "fetchers/earn/targetYieldPool/fetchTargetRate";
import type { Address } from "viem";

import { combineWithEpochId } from "./combineWithEpochId";
import { useEpochId } from "./useEpochId";

export const targetRateOptions = ({
  epochId,
  stakingVaultAddress,
}: {
  epochId: bigint | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
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
