import { tokenBalanceQueryOptions } from "@hemilabs/react-hooks/useTokenBalance";
import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { convertToAssetsQueryOptions } from "hooks/useConvertToAssets";
import { useEthereumClient } from "hooks/useEthereumClient";
import { mainnet } from "networks/mainnet";
import type { Address, Client } from "viem";
import { useAccount } from "wagmi";

export const stakedBalanceQueryKey = ({
  account,
  chainId,
  stakingVaultAddress,
}: {
  account: Address;
  chainId: number;
  stakingVaultAddress: Address;
}) => ["staked-balance", chainId, stakingVaultAddress, account];

export const stakedBalanceQueryOptions = ({
  account,
  chainId,
  client,
  queryClient,
  stakingVaultAddress,
}: {
  account: Address | undefined;
  chainId: number;
  client: Client | undefined;
  queryClient: QueryClient;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: !!client && !!account,
    async queryFn() {
      const shares = await queryClient.ensureQueryData(
        tokenBalanceQueryOptions({
          account: account!,
          client: client!,
          token: { address: stakingVaultAddress, chainId },
        }),
      );
      return queryClient.ensureQueryData(
        convertToAssetsQueryOptions({
          client,
          shares,
          stakingVaultAddress,
        }),
      );
    },
    queryKey: stakedBalanceQueryKey({
      account: account!,
      chainId,
      stakingVaultAddress,
    }),
  });

export function useStakedBalance(stakingVaultAddress: Address) {
  const { address: account } = useAccount();
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  return useQuery(
    stakedBalanceQueryOptions({
      account,
      chainId: mainnet.id,
      client,
      queryClient,
      stakingVaultAddress,
    }),
  );
}
