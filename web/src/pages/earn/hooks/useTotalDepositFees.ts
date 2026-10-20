import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { fetchTotalDepositFees } from "fetchers/fetchTotalDepositFees";
import { useEthereumClient } from "hooks/useEthereumClient";
import { mainnet } from "networks/mainnet";
import { type Address, type Chain, type Client } from "viem";
import { useAccount } from "wagmi";

const totalDepositFeesOptions = ({
  amount,
  approveAmount,
  chain,
  client,
  owner,
  queryClient,
  stakingVaultAddress,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  chain: Chain;
  client: Client | undefined;
  owner: Address | undefined;
  queryClient: QueryClient;
  stakingVaultAddress: Address;
  token: Token | undefined;
}) =>
  queryOptions({
    enabled: !!client && !!owner && !!token && amount > 0n,
    queryFn: () =>
      fetchTotalDepositFees({
        amount,
        approveAmount,
        chain,
        client: client!,
        owner: owner!,
        queryClient,
        stakingVaultAddress,
        token: token!,
      }),
    queryKey: [
      "total-deposit-fees",
      chain.id,
      token?.address,
      owner,
      amount.toString(),
      stakingVaultAddress,
    ],
  });

export const useTotalDepositFees = function ({
  amount,
  approveAmount,
  stakingVaultAddress,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  stakingVaultAddress: Address;
  token: Token | undefined;
}) {
  const { address: owner } = useAccount();
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  return useQuery(
    totalDepositFeesOptions({
      amount,
      approveAmount,
      chain: mainnet,
      client,
      owner,
      queryClient,
      stakingVaultAddress,
      token,
    }),
  );
};
