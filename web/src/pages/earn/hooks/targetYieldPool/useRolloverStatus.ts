import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchRolloverStatus } from "fetchers/earn/targetYieldPool/fetchRolloverStatus";
import { useEthereumClient } from "hooks/useEthereumClient";
import type { Address, Client } from "viem";
import { useAccount } from "wagmi";

import { combineWithEpochId } from "./combineWithEpochId";
import { useEpochId } from "./useEpochId";

const rolloverStatusOptions = ({
  account,
  client,
  epochId,
  stakingVaultAddress,
}: {
  account: Address | undefined;
  client: Client | undefined;
  epochId: bigint | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: !!account && !!client && epochId !== undefined,
    queryFn: fetchRolloverStatus,
    queryKey: [
      "target-yield-pool-rollover-status",
      client?.chain?.id,
      stakingVaultAddress,
      epochId?.toString(),
      account,
    ],
  });

export function useRolloverStatus(stakingVaultAddress: Address) {
  const { address: account } = useAccount();
  const client = useEthereumClient();
  const epochId = useEpochId(stakingVaultAddress);
  const query = useQuery(
    rolloverStatusOptions({
      account,
      client,
      epochId: epochId.data,
      stakingVaultAddress,
    }),
  );

  return combineWithEpochId({ epochId, query });
}
