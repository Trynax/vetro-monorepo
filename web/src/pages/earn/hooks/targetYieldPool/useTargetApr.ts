import { useQuery } from "@tanstack/react-query";
import { type Address, formatUnits } from "viem";

import { combineWithEpochId } from "./combineWithEpochId";
import { useEpochId } from "./useEpochId";
import { targetRateOptions } from "./useTargetRate";

export function useTargetApr(stakingVaultAddress: Address) {
  const epochId = useEpochId(stakingVaultAddress);
  const query = useQuery({
    ...targetRateOptions({ epochId: epochId.data, stakingVaultAddress }),
    // The rate is a WAD fraction, so this equals formatUnits(rate, 18) * 100
    select: (rate) => Number(formatUnits(rate, 16)),
  });

  return combineWithEpochId({ epochId, query });
}
