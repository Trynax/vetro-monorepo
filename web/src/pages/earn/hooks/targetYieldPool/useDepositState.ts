import { type UseQueryResult, useQueries } from "@tanstack/react-query";
import { combineQueryResults } from "utils/queries";
import type { Address } from "viem";

import { type Epoch, epochOptions } from "./useEpoch";
import { epochIdOptions, useEpochId } from "./useEpochId";
import { isPausedOptions } from "./useIsPaused";
import { isShutdownOptions } from "./useIsShutdown";
import { isTerminatedOptions } from "./useIsTerminated";

const combineDepositState = (
  results: [
    UseQueryResult<bigint>,
    UseQueryResult<Epoch>,
    UseQueryResult<boolean>,
    UseQueryResult<boolean>,
    UseQueryResult<boolean>,
  ],
) =>
  combineQueryResults({
    results,
    select: ([, epoch, isPaused, isShutdown, isTerminated]) => ({
      ...epoch,
      isPaused,
      isShutdown,
      isTerminated,
    }),
  });

export function useDepositState(stakingVaultAddress: Address) {
  const epochId = useEpochId(stakingVaultAddress);

  return useQueries({
    combine: combineDepositState,
    queries: [
      epochIdOptions(stakingVaultAddress),
      epochOptions({ epochId: epochId.data, stakingVaultAddress }),
      isPausedOptions(stakingVaultAddress),
      isShutdownOptions(stakingVaultAddress),
      isTerminatedOptions(stakingVaultAddress),
    ],
  });
}
