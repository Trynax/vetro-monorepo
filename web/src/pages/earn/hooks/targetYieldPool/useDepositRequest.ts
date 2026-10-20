import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchDepositRequest } from "fetchers/earn/targetYieldPool/fetchDepositRequest";
import type { Address } from "viem";
import { useAccount } from "wagmi";

import { getDepositRequestState } from "./getDepositRequestState";

const depositRequestOptions = ({
  controller,
  stakingVaultAddress,
}: {
  controller: Address | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: !!controller,
    queryFn: () =>
      fetchDepositRequest({ controller: controller!, stakingVaultAddress }),
    queryKey: [
      "target-yield-pool-deposit-request",
      stakingVaultAddress,
      controller,
    ],
    select: getDepositRequestState,
  });

export function useDepositRequest(stakingVaultAddress: Address) {
  const { address: controller } = useAccount();

  return useQuery(depositRequestOptions({ controller, stakingVaultAddress }));
}
