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
import { mainnet } from "networks/mainnet";
import { type Address, type Chain, type Client, type Hash } from "viem";
import { useAccount } from "wagmi";

const repayGasUnitsQueryKey = ({
  amount,
  chainId,
  marketId,
  owner,
  token,
}: {
  amount: bigint;
  chainId: Chain["id"];
  marketId: Hash;
  owner: Address | undefined;
  token: Token | undefined;
}) => [
  "borrow-repay-gas-units",
  chainId,
  marketId,
  token?.address,
  owner,
  amount.toString(),
];

export const repayGasUnitsOptions = ({
  amount,
  approveAmount,
  chainId,
  client,
  marketId,
  owner,
  queryClient,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  chainId: Chain["id"];
  client: Client | undefined;
  marketId: Hash;
  owner: Address | undefined;
  queryClient: QueryClient;
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
        token: token!,
      }),
    queryKey: repayGasUnitsQueryKey({
      amount,
      chainId,
      marketId,
      owner,
      token,
    }),
  });

const totalRepayFeesQueryKey = ({
  amount,
  chainId,
  marketId,
  owner,
  token,
}: {
  amount: bigint;
  chainId: Chain["id"];
  marketId: Hash;
  owner: Address | undefined;
  token: Token | undefined;
}) => [
  "total-repay-fees",
  chainId,
  marketId,
  token?.address,
  owner,
  amount.toString(),
];

const totalRepayFeesOptions = ({
  amount,
  approveAmount,
  chain,
  client,
  marketId,
  owner,
  queryClient,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  chain: Chain;
  client: Client | undefined;
  marketId: Hash;
  owner: Address | undefined;
  queryClient: QueryClient;
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
        token: token!,
      }),
    queryKey: totalRepayFeesQueryKey({
      amount,
      chainId: chain.id,
      marketId,
      owner,
      token,
    }),
  });

export const useTotalRepayFees = function ({
  amount,
  approveAmount,
  marketId,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  marketId: Hash;
  token: Token | undefined;
}) {
  const { address: owner } = useAccount();
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  return useQuery(
    totalRepayFeesOptions({
      amount,
      approveAmount,
      chain: mainnet,
      client,
      marketId,
      owner,
      queryClient,
      token,
    }),
  );
};
