import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchTotalWithdrawCollateralFees } from "fetchers/fetchTotalWithdrawCollateralFees";
import { fetchWithdrawCollateralGasUnits } from "fetchers/fetchWithdrawCollateralGasUnits";
import { useEthereumClient } from "hooks/useEthereumClient";
import { mainnet } from "networks/mainnet";
import { type Address, type Chain, type Client, type Hash } from "viem";
import { useAccount } from "wagmi";

const withdrawCollateralGasUnitsQueryKey = ({
  amount,
  chainId,
  marketId,
  owner,
}: {
  amount: bigint;
  chainId: Chain["id"];
  marketId: Hash;
  owner: Address | undefined;
}) => [
  "borrow-withdraw-collateral-gas-units",
  chainId,
  marketId,
  owner,
  amount.toString(),
];

export const withdrawCollateralGasUnitsOptions = ({
  amount,
  chainId,
  client,
  marketId,
  owner,
  queryClient,
}: {
  amount: bigint;
  chainId: Chain["id"];
  client: Client | undefined;
  marketId: Hash;
  owner: Address | undefined;
  queryClient: QueryClient;
}) =>
  queryOptions({
    enabled: !!client && !!owner && amount > 0n,
    queryFn: () =>
      fetchWithdrawCollateralGasUnits({
        amount,
        client: client!,
        marketId,
        owner: owner!,
        queryClient,
      }),
    queryKey: withdrawCollateralGasUnitsQueryKey({
      amount,
      chainId,
      marketId,
      owner,
    }),
  });

const totalWithdrawCollateralFeesQueryKey = ({
  amount,
  chainId,
  marketId,
  owner,
}: {
  amount: bigint;
  chainId: Chain["id"];
  marketId: Hash;
  owner: Address | undefined;
}) => [
  "total-withdraw-collateral-fees",
  chainId,
  marketId,
  owner,
  amount.toString(),
];

const totalWithdrawCollateralFeesOptions = ({
  amount,
  chain,
  client,
  marketId,
  owner,
  queryClient,
}: {
  amount: bigint;
  chain: Chain;
  client: Client | undefined;
  marketId: Hash;
  owner: Address | undefined;
  queryClient: QueryClient;
}) =>
  queryOptions({
    enabled: !!client && !!owner && amount > 0n,
    queryFn: () =>
      fetchTotalWithdrawCollateralFees({
        amount,
        chain,
        client: client!,
        marketId,
        owner: owner!,
        queryClient,
      }),
    queryKey: totalWithdrawCollateralFeesQueryKey({
      amount,
      chainId: chain.id,
      marketId,
      owner,
    }),
  });

export const useTotalWithdrawCollateralFees = function ({
  amount,
  marketId,
}: {
  amount: bigint;
  marketId: Hash;
}) {
  const { address: owner } = useAccount();
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  return useQuery(
    totalWithdrawCollateralFeesOptions({
      amount,
      chain: mainnet,
      client,
      marketId,
      owner,
      queryClient,
    }),
  );
};
