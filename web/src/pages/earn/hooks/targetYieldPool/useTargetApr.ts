import { useQuery } from "@tanstack/react-query";
import { type Address, formatUnits } from "viem";

import { combineWithEpochId } from "./combineWithEpochId";
import { useEpochId } from "./useEpochId";
import { targetRateOptions } from "./useTargetRate";

// The rate is a WAD fraction, so this equals formatUnits(rate, 18) * 100
const toApr = (rate: bigint) => Number(formatUnits(rate, 16));

export function useTargetApr(stakingVaultAddress: Address) {
  const epochId = useEpochId(stakingVaultAddress);
  const query = useQuery(
    targetRateOptions({
      epochId: epochId.data,
      select: toApr,
      stakingVaultAddress,
    }),
  );

  return combineWithEpochId({ epochId, query });
}
