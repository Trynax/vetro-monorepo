import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEthereumClient } from "hooks/useEthereumClient";
import type { Address, Client } from "viem";
import { convertToAssets } from "viem-erc4626/actions";

export const convertToAssetsQueryOptions = ({
  client,
  shares,
  stakingVaultAddress,
}: {
  client: Client;
  shares: bigint | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: shares !== undefined,
    queryFn: () =>
      convertToAssets(client, {
        address: stakingVaultAddress,
        shares: shares!,
      }),
    queryKey: [
      "convert-to-assets",
      client.chain?.id,
      stakingVaultAddress,
      shares?.toString(),
    ],
  });

export function useConvertToAssets({
  shares,
  stakingVaultAddress,
}: {
  shares: bigint;
  stakingVaultAddress: Address;
}) {
  const client = useEthereumClient();

  return useQuery({
    ...convertToAssetsQueryOptions({
      client: client!,
      shares,
      stakingVaultAddress,
    }),
    enabled: !!client && shares > 0n,
  });
}
