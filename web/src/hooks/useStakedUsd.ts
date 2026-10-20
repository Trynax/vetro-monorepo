import { queryOptions } from "@tanstack/react-query";
import { fetchStakedUsd } from "fetchers/fetchStakedUsd";
import type { Address, Client } from "viem";

export const stakedUsdQueryKey = ({
  account,
  chainId,
  stakingVaultAddress,
}: {
  account: Address | undefined;
  chainId: number | undefined;
  stakingVaultAddress: Address;
}) => ["staked-usd", chainId, stakingVaultAddress, account];

export const stakedUsdQueryOptions = ({
  account,
  client,
  stakingVaultAddress,
}: {
  account: Address | undefined;
  client: Client | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: !!client && !!account,
    queryFn: ({ client: queryClient }) =>
      fetchStakedUsd({
        account: account!,
        client: client!,
        queryClient,
        stakingVaultAddress,
      }),
    queryKey: stakedUsdQueryKey({
      account,
      chainId: client?.chain?.id,
      stakingVaultAddress,
    }),
  });
