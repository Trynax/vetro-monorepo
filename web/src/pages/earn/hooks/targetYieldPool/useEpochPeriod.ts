import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchEpochPeriod } from "fetchers/earn/targetYieldPool/fetchEpochPeriod";
import type { Address } from "viem";

import { combineWithEpochId } from "./combineWithEpochId";
import { useEpochId } from "./useEpochId";

const epochPeriodOptions = ({
  epochId,
  stakingVaultAddress,
}: {
  epochId: bigint | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: epochId !== undefined,
    queryFn: fetchEpochPeriod,
    queryKey: [
      "target-yield-pool-epoch-period",
      stakingVaultAddress,
      epochId?.toString(),
    ],
  });

export function useEpochPeriod(stakingVaultAddress: Address) {
  const epochId = useEpochId(stakingVaultAddress);
  const query = useQuery(
    epochPeriodOptions({ epochId: epochId.data, stakingVaultAddress }),
  );

  return combineWithEpochId({ epochId, query });
}
