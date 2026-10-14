import type { QueryClient } from "@tanstack/react-query";
import { pricesOptions } from "hooks/usePrices";
import { vaultPeggedTokenQueryOptions } from "hooks/useVaultPeggedToken";
import { epochOptions } from "pages/earn/hooks/targetYieldPool/useEpoch";
import { tokenAmountToUsd } from "utils/currency";
import type { Address, Client } from "viem";

export const fetchDeposits = async function ({
  client,
  epochId,
  queryClient,
  stakingVaultAddress,
}: {
  client: Client;
  epochId: bigint;
  queryClient: QueryClient;
  stakingVaultAddress: Address;
}) {
  const [epoch, peggedToken, prices] = await Promise.all([
    queryClient.ensureQueryData(epochOptions({ epochId, stakingVaultAddress })),
    queryClient.ensureQueryData(
      vaultPeggedTokenQueryOptions({
        client,
        queryClient,
        stakingVaultAddress,
      }),
    ),
    queryClient.ensureQueryData(pricesOptions({ client, queryClient })),
  ]);

  return {
    maxDepositsUsd: tokenAmountToUsd({
      amount: epoch.maxDeposits,
      prices,
      token: peggedToken,
    }),
    totalDepositsUsd: tokenAmountToUsd({
      amount: epoch.deposits,
      prices,
      token: peggedToken,
    }),
  };
};
