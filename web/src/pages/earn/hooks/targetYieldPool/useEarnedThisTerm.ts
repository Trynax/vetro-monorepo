import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchEarnedThisTerm } from "fetchers/earn/targetYieldPool/fetchEarnedThisTerm";
import type { Address } from "viem";
import { useAccount } from "wagmi";

import { combineWithEpochId } from "./combineWithEpochId";
import { useEpochId } from "./useEpochId";

const earnedThisTermOptions = ({
  account,
  epochId,
  stakingVaultAddress,
}: {
  account: Address | undefined;
  epochId: bigint | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: !!account && epochId !== undefined,
    queryFn: () => fetchEarnedThisTerm(epochId!),
    queryKey: [
      "target-yield-pool-earned-this-term",
      stakingVaultAddress,
      epochId?.toString(),
      account,
    ],
  });

export function useEarnedThisTerm(stakingVaultAddress: Address) {
  const { address: account } = useAccount();
  const epochId = useEpochId(stakingVaultAddress);
  const query = useQuery(
    earnedThisTermOptions({
      account,
      epochId: epochId.data,
      stakingVaultAddress,
    }),
  );

  return combineWithEpochId({ epochId, query });
}
