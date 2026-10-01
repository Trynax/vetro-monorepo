import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchMaxRequestDeposit } from "fetchers/earn/targetYieldPool/fetchMaxRequestDeposit";
import type { Address } from "viem";
import { useAccount } from "wagmi";

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
  const { data: epochId } = useEpochId(stakingVaultAddress);
  return useQuery(
    maxRequestDepositOptions({ controller, epochId, stakingVaultAddress }),
  );
}
