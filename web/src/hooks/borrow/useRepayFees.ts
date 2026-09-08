import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { fetchRepayGasUnits } from "fetchers/fetchRepayGasUnits";
import { fetchTotalRepayFees } from "fetchers/fetchTotalRepayFees";
import { useEthereumClient } from "hooks/useEthereumClient";
import { useMainnet } from "hooks/useMainnet";
import { type Address, type Chain, type Client, type Hash } from "viem";
import { useAccount } from "wagmi";

const repayGasUnitsQueryKey = ({
  amount,
  approveAmount,
  chainId,
  marketId,
  owner,
  shares,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  chainId: Chain["id"];
  marketId: Hash;
  owner: Address | undefined;
  shares: bigint | undefined;
  token: Token | undefined;
}) => [
  "borrow-repay-gas-units",
  chainId,
  marketId,
  token?.address,
  owner,
  amount.toString(),
  approveAmount?.toString(),
  shares?.toString(),
];

export const repayGasUnitsOptions = ({
  amount,
  approveAmount,
  chainId,
  client,
  marketId,
  owner,
  queryClient,
  shares,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  chainId: Chain["id"];
  client: Client | undefined;
  marketId: Hash;
  owner: Address | undefined;
  queryClient: QueryClient;
  shares: bigint | undefined;
  token: Token | undefined;
}) =>
  queryOptions({
    enabled: !!client && !!owner && !!token && amount > 0n,
    queryFn: () =>
      fetchRepayGasUnits({
        amount,
        approveAmount,
        client: client!,
        marketId,
        owner: owner!,
        queryClient,
        shares,
        token: token!,
      }),
    queryKey: repayGasUnitsQueryKey({
      amount,
      approveAmount,
      chainId,
      marketId,
      owner,
      shares,
      token,
    }),
  });

const totalRepayFeesQueryKey = ({
  amount,
  approveAmount,
  chainId,
  marketId,
  owner,
  shares,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  chainId: Chain["id"];
  marketId: Hash;
  owner: Address | undefined;
  shares: bigint | undefined;
  token: Token | undefined;
}) => [
  "total-repay-fees",
  chainId,
  marketId,
  token?.address,
  owner,
  amount.toString(),
  approveAmount?.toString(),
  shares?.toString(),
];

const totalRepayFeesOptions = ({
  amount,
  approveAmount,
  chain,
  client,
  marketId,
  owner,
  queryClient,
  shares,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  chain: Chain;
  client: Client | undefined;
  marketId: Hash;
  owner: Address | undefined;
  queryClient: QueryClient;
  shares: bigint | undefined;
  token: Token | undefined;
}) =>
  queryOptions({
    enabled: !!client && !!owner && !!token && amount > 0n,
    queryFn: () =>
      fetchTotalRepayFees({
        amount,
        approveAmount,
        chain,
        client: client!,
        marketId,
        owner: owner!,
        queryClient,
        shares,
        token: token!,
      }),
    queryKey: totalRepayFeesQueryKey({
      amount,
      approveAmount,
      chainId: chain.id,
      marketId,
      owner,
      shares,
      token,
    }),
  });

export const useTotalRepayFees = function ({
  amount,
  approveAmount,
  marketId,
  shares,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  marketId: Hash;
  shares?: bigint;
  token: Token | undefined;
}) {
  const { address: owner } = useAccount();
  const client = useEthereumClient();
  const ethereumChain = useMainnet();
  const queryClient = useQueryClient();

  return useQuery(
    totalRepayFeesOptions({
      amount,
      approveAmount,
      chain: ethereumChain,
      client,
      marketId,
      owner,
      queryClient,
      shares,
      token,
    }),
  );
};
