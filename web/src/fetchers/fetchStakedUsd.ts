import type { QueryClient } from "@tanstack/react-query";
import { fetchVaultStakePosition } from "fetchers/fetchVaultStakePosition";
import { tokenAmountToUsd } from "utils/currency";
import type { Address, Client } from "viem";

export const fetchStakedUsd = async function ({
  account,
  client,
  queryClient,
  stakingVaultAddress,
}: {
  account: Address;
  client: Client;
  queryClient: QueryClient;
  stakingVaultAddress: Address;
}): Promise<number> {
  const { peggedToken, prices, stakedAssets } = await fetchVaultStakePosition({
    account,
    client,
    queryClient,
    stakingVaultAddress,
  });

  return tokenAmountToUsd({ amount: stakedAssets, prices, token: peggedToken });
};
