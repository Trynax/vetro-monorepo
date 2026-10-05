import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEthereumClient } from "hooks/useEthereumClient";
import type { Address, Client } from "viem";
import { convertToShares } from "viem-erc4626/actions";

const convertToSharesOptions = ({
  assets,
  client,
  stakingVaultAddress,
}: {
  assets: bigint;
  client: Client | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: !!client && assets > 0n,
    queryFn: () =>
      convertToShares(client!, { address: stakingVaultAddress, assets }),
    queryKey: [
      "convert-to-shares",
      client?.chain?.id,
      stakingVaultAddress,
      assets.toString(),
    ],
  });

export function useConvertToShares({
  assets,
  stakingVaultAddress,
}: {
  assets: bigint;
  stakingVaultAddress: Address;
}) {
  const client = useEthereumClient();

  return useQuery(
    convertToSharesOptions({ assets, client, stakingVaultAddress }),
  );
}
