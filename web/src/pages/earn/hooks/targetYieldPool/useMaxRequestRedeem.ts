import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchMaxRequestRedeem } from "fetchers/earn/targetYieldPool/fetchMaxRequestRedeem";
import type { Address } from "viem";
import { useAccount } from "wagmi";

import { combineWithEpochId } from "./combineWithEpochId";
import { useEpochId } from "./useEpochId";

const maxRequestRedeemOptions = ({
  epochId,
  owner,
  stakingVaultAddress,
}: {
  epochId: bigint | undefined;
  owner: Address | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: !!owner && epochId !== undefined,
    queryFn: () => fetchMaxRequestRedeem(epochId!),
    queryKey: [
      "target-yield-pool-max-request-redeem",
      stakingVaultAddress,
      owner,
      epochId?.toString(),
    ],
  });

export function useMaxRequestRedeem(stakingVaultAddress: Address) {
  const { address: owner } = useAccount();
  const epochId = useEpochId(stakingVaultAddress);
  const query = useQuery(
    maxRequestRedeemOptions({
      epochId: epochId.data,
      owner,
      stakingVaultAddress,
    }),
  );

  return combineWithEpochId({ epochId, query });
}
