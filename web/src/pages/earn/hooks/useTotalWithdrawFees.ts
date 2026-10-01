import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchTotalWithdrawFees } from "fetchers/fetchTotalWithdrawFees";
import { useEthereumClient } from "hooks/useEthereumClient";
import { mainnet } from "networks/mainnet";
import { type Address, type Chain, type Client } from "viem";
import { useAccount } from "wagmi";

const totalWithdrawFeesOptions = ({
  amount,
  chain,
  client,
  owner,
  queryClient,
  stakingVaultAddress,
}: {
  amount: bigint;
  chain: Chain;
  client: Client | undefined;
  owner: Address | undefined;
  queryClient: QueryClient;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: !!client && !!owner && amount > 0n,
    queryFn: () =>
      fetchTotalWithdrawFees({
        amount,
        chain,
        client: client!,
        owner: owner!,
        queryClient,
        stakingVaultAddress,
      }),
    queryKey: [
      "total-withdraw-fees",
      chain.id,
      owner,
      amount.toString(),
      stakingVaultAddress,
    ],
  });

export const useTotalWithdrawFees = function ({
  amount,
  stakingVaultAddress,
}: {
  amount: bigint;
  stakingVaultAddress: Address;
}) {
  const { address: owner } = useAccount();
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  return useQuery(
    totalWithdrawFeesOptions({
      amount,
      chain: mainnet,
      client,
      owner,
      queryClient,
      stakingVaultAddress,
    }),
  );
};
