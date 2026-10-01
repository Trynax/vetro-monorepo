import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchAccrualInterval } from "fetchers/earn/targetYieldPool/fetchAccrualInterval";
import type { Address } from "viem";

import { combineWithEpochId } from "./combineWithEpochId";
import { useEpochId } from "./useEpochId";

const accrualIntervalOptions = ({
  epochId,
  stakingVaultAddress,
}: {
  epochId: bigint | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: epochId !== undefined,
    queryFn: fetchAccrualInterval,
    queryKey: [
      "target-yield-pool-accrual-interval",
      stakingVaultAddress,
      epochId?.toString(),
    ],
  });

export function useAccrualInterval(stakingVaultAddress: Address) {
  const epochId = useEpochId(stakingVaultAddress);
  const query = useQuery(
    accrualIntervalOptions({ epochId: epochId.data, stakingVaultAddress }),
  );

  return combineWithEpochId({ epochId, query });
}
