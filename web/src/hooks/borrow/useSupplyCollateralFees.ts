import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { fetchSupplyCollateralGasUnits } from "fetchers/fetchSupplyCollateralGasUnits";
import { fetchTotalSupplyCollateralFees } from "fetchers/fetchTotalSupplyCollateralFees";
import { useEthereumClient } from "hooks/useEthereumClient";
import { mainnet } from "networks/mainnet";
import { type Address, type Chain, type Client, type Hash } from "viem";
import { useAccount } from "wagmi";

const supplyCollateralGasUnitsQueryKey = ({
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
  "borrow-supply-collateral-gas-units",
  chainId,
  marketId,
  token?.address,
  owner,
  amount.toString(),
];

export const supplyCollateralGasUnitsOptions = ({
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
      fetchSupplyCollateralGasUnits({
        amount,
        approveAmount,
        client: client!,
        marketId,
        owner: owner!,
        queryClient,
        token: token!,
      }),
    queryKey: supplyCollateralGasUnitsQueryKey({
      amount,
      chainId,
      marketId,
      owner,
      token,
    }),
  });

const totalSupplyCollateralFeesQueryKey = ({
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
  "total-supply-collateral-fees",
  chainId,
  marketId,
  token?.address,
  owner,
  amount.toString(),
];

const totalSupplyCollateralFeesOptions = ({
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
      fetchTotalSupplyCollateralFees({
        amount,
        approveAmount,
        chain,
        client: client!,
        marketId,
        owner: owner!,
        queryClient,
        token: token!,
      }),
    queryKey: totalSupplyCollateralFeesQueryKey({
      amount,
      chainId: chain.id,
      marketId,
      owner,
      token,
    }),
  });

export const useTotalSupplyCollateralFees = function ({
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
    totalSupplyCollateralFeesOptions({
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
