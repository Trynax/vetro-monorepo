import type { QueryClient } from "@tanstack/react-query";
import { pricesOptions } from "hooks/usePrices";
import { stakedBalanceQueryOptions } from "hooks/useStakedBalance";
import { vaultPeggedTokenQueryOptions } from "hooks/useVaultPeggedToken";
import type { Address, Client } from "viem";

export const fetchVaultStakePosition = async function ({
  account,
  client,
  queryClient,
  stakingVaultAddress,
}: {
  account: Address;
  client: Client;
  queryClient: QueryClient;
  stakingVaultAddress: Address;
}) {
  const chainId = client.chain?.id;
  if (chainId === undefined) {
    throw new Error("Client is missing a chain");
  }

  const [peggedToken, prices, stakedAssets] = await Promise.all([
    queryClient.ensureQueryData(
      vaultPeggedTokenQueryOptions({
        client,
        queryClient,
        stakingVaultAddress,
      }),
    ),
    queryClient.ensureQueryData(pricesOptions({ client, queryClient })),
    queryClient.ensureQueryData(
      stakedBalanceQueryOptions({
        account,
        chainId,
        client,
        queryClient,
        stakingVaultAddress,
      }),
    ),
  ]);

  return { peggedToken, prices, stakedAssets };
};
