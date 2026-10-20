import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { fetchRequestDepositFees } from "fetchers/earn/targetYieldPool/fetchRequestDepositFees";
import { useEthereumClient } from "hooks/useEthereumClient";
import type { Address, Client } from "viem";
import { useAccount } from "wagmi";

const requestDepositFeesOptions = ({
  amount,
  approveAmount,
  client,
  owner,
  stakingVaultAddress,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  client: Client | undefined;
  owner: Address | undefined;
  stakingVaultAddress: Address;
  token: Token;
}) =>
  queryOptions({
    enabled: !!client && !!owner && amount > 0n,
    queryFn: ({ client: queryClient }) =>
      fetchRequestDepositFees({
        amount,
        approveAmount,
        client: client!,
        owner: owner!,
        queryClient,
        stakingVaultAddress,
        token,
      }),
    queryKey: [
      "target-yield-pool-request-deposit-fees",
      token.chainId,
      token.address,
      owner,
      amount.toString(),
      approveAmount?.toString(),
      stakingVaultAddress,
    ],
  });

export const useRequestDepositFees = function ({
  amount,
  approveAmount,
  stakingVaultAddress,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  stakingVaultAddress: Address;
  token: Token;
}) {
  const { address: owner } = useAccount();
  const client = useEthereumClient();

  return useQuery(
    requestDepositFeesOptions({
      amount,
      approveAmount,
      client,
      owner,
      stakingVaultAddress,
      token,
    }),
  );
};
