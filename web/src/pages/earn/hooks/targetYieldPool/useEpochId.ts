import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchEpochId } from "fetchers/earn/targetYieldPool/fetchEpochId";
import type { Address } from "viem";

export const epochIdOptions = (stakingVaultAddress: Address) =>
  queryOptions({
    queryFn: fetchEpochId,
    queryKey: ["target-yield-epoch-id", stakingVaultAddress],
  });

export const useEpochId = (stakingVaultAddress: Address) =>
  useQuery(epochIdOptions(stakingVaultAddress));
