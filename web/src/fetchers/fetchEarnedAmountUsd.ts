import { tokenBalanceQueryOptions } from "@hemilabs/react-hooks/useTokenBalance";
import type { QueryClient } from "@tanstack/react-query";
import { fetchVaultStakePosition } from "fetchers/fetchVaultStakePosition";
import { costBasisQueryOptions } from "hooks/useCostBasis";
import { tokenAmountToUsd } from "utils/currency";
import type { Address, Client } from "viem";

export const fetchEarnedAmountUsd = async function ({
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
  const chainId = client.chain?.id;
  if (chainId === undefined) {
    throw new Error("Client is missing a chain");
  }

  const [{ peggedToken, prices, stakedAssets }, costBases, userShares] =
    await Promise.all([
      fetchVaultStakePosition({
        account,
        client,
        queryClient,
        stakingVaultAddress,
      }),
      queryClient.ensureQueryData(costBasisQueryOptions({ address: account })),
      queryClient.ensureQueryData(
        tokenBalanceQueryOptions({
          account,
          client,
          token: { address: stakingVaultAddress, chainId },
        }),
      ),
    ]);

  if (userShares === 0n) {
    return 0;
  }

  const costBasis = costBases[stakingVaultAddress] ?? 0n;
  if (costBasis === 0n) {
    return 0;
  }

  return tokenAmountToUsd({
    amount: stakedAssets - costBasis,
    prices,
    token: peggedToken,
  });
};
