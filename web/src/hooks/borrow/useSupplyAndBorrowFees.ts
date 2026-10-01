import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { fetchSupplyAndBorrowGasUnits } from "fetchers/fetchSupplyAndBorrowGasUnits";
import { fetchTotalSupplyAndBorrowFees } from "fetchers/fetchTotalSupplyAndBorrowFees";
import { useEthereumClient } from "hooks/useEthereumClient";
import { mainnet } from "networks/mainnet";
import { type Address, type Chain, type Client, type Hash } from "viem";
import { useAccount } from "wagmi";

const supplyAndBorrowGasUnitsQueryKey = ({
  borrowAmount,
  chainId,
  collateralAmount,
  collateralToken,
  marketId,
  owner,
}: {
  borrowAmount: bigint;
  chainId: Chain["id"];
  collateralAmount: bigint;
  collateralToken: Token | undefined;
  marketId: Hash;
  owner: Address | undefined;
}) => [
  "borrow-supply-and-borrow-gas-units",
  chainId,
  marketId,
  collateralToken?.address,
  owner,
  borrowAmount.toString(),
  collateralAmount.toString(),
];

export const supplyAndBorrowGasUnitsOptions = ({
  approveAmount,
  borrowAmount,
  chainId,
  client,
  collateralAmount,
  collateralToken,
  marketId,
  owner,
  queryClient,
}: {
  approveAmount: bigint | undefined;
  borrowAmount: bigint;
  chainId: Chain["id"];
  client: Client | undefined;
  collateralAmount: bigint;
  collateralToken: Token | undefined;
  marketId: Hash;
  owner: Address | undefined;
  queryClient: QueryClient;
}) =>
  queryOptions({
    enabled:
      !!client &&
      !!owner &&
      !!collateralToken &&
      borrowAmount > 0n &&
      collateralAmount > 0n,
    queryFn: () =>
      fetchSupplyAndBorrowGasUnits({
        approveAmount,
        borrowAmount,
        client: client!,
        collateralAmount,
        collateralToken: collateralToken!,
        marketId,
        owner: owner!,
        queryClient,
      }),
    queryKey: supplyAndBorrowGasUnitsQueryKey({
      borrowAmount,
      chainId,
      collateralAmount,
      collateralToken,
      marketId,
      owner,
    }),
  });

const totalSupplyAndBorrowFeesQueryKey = ({
  borrowAmount,
  chainId,
  collateralAmount,
  collateralToken,
  marketId,
  owner,
}: {
  borrowAmount: bigint;
  chainId: Chain["id"];
  collateralAmount: bigint;
  collateralToken: Token | undefined;
  marketId: Hash;
  owner: Address | undefined;
}) => [
  "total-supply-and-borrow-fees",
  chainId,
  marketId,
  collateralToken?.address,
  owner,
  borrowAmount.toString(),
  collateralAmount.toString(),
];

const totalSupplyAndBorrowFeesOptions = ({
  approveAmount,
  borrowAmount,
  chain,
  client,
  collateralAmount,
  collateralToken,
  marketId,
  owner,
  queryClient,
}: {
  approveAmount: bigint | undefined;
  borrowAmount: bigint;
  chain: Chain;
  client: Client | undefined;
  collateralAmount: bigint;
  collateralToken: Token | undefined;
  marketId: Hash;
  owner: Address | undefined;
  queryClient: QueryClient;
}) =>
  queryOptions({
    enabled:
      !!client &&
      !!owner &&
      !!collateralToken &&
      borrowAmount > 0n &&
      collateralAmount > 0n,
    queryFn: () =>
      fetchTotalSupplyAndBorrowFees({
        approveAmount,
        borrowAmount,
        chain,
        client: client!,
        collateralAmount,
        collateralToken: collateralToken!,
        marketId,
        owner: owner!,
        queryClient,
      }),
    queryKey: totalSupplyAndBorrowFeesQueryKey({
      borrowAmount,
      chainId: chain.id,
      collateralAmount,
      collateralToken,
      marketId,
      owner,
    }),
  });

export const useTotalSupplyAndBorrowFees = function ({
  approveAmount,
  borrowAmount,
  collateralAmount,
  collateralToken,
  marketId,
}: {
  approveAmount: bigint | undefined;
  borrowAmount: bigint;
  collateralAmount: bigint;
  collateralToken: Token | undefined;
  marketId: Hash;
}) {
  const { address: owner } = useAccount();
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  return useQuery(
    totalSupplyAndBorrowFeesOptions({
      approveAmount,
      borrowAmount,
      chain: mainnet,
      client,
      collateralAmount,
      collateralToken,
      marketId,
      owner,
      queryClient,
    }),
  );
};
