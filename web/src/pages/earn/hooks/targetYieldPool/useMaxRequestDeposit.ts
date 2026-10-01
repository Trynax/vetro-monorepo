import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchMaxRequestDeposit } from "fetchers/earn/targetYieldPool/fetchMaxRequestDeposit";
import type { Address } from "viem";
import { useAccount } from "wagmi";

import { combineWithEpochId } from "./combineWithEpochId";
import { useEpochId } from "./useEpochId";

const maxRequestDepositOptions = ({
  controller,
  epochId,
  stakingVaultAddress,
}: {
  controller: Address | undefined;
  epochId: bigint | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: !!controller && epochId !== undefined,
    queryFn: () => fetchMaxRequestDeposit(epochId!),
    queryKey: [
      "target-yield-pool-max-request-deposit",
      stakingVaultAddress,
      controller,
      epochId?.toString(),
    ],
  });

export function useMaxRequestDeposit(stakingVaultAddress: Address) {
  const { address: controller } = useAccount();
  const epochId = useEpochId(stakingVaultAddress);
  const query = useQuery(
    maxRequestDepositOptions({
      controller,
      epochId: epochId.data,
      stakingVaultAddress,
    }),
  );

  return combineWithEpochId({ epochId, query });
}
