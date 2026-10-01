import type { QueryClient } from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { estimateApprovalGasUnits } from "fetchers/estimateApprovalGasUnits";
import { fetchTotalNetworkFees } from "fetchers/fetchTotalNetworkFees";
import { getChainById } from "networks";
import type { Address, Client } from "viem";

// TODO estimate fees from VUSDx contract
// https://github.com/vetro-protocol/vetro-monorepo/issues/646
const requestDepositGasUnits = 400n;

export const fetchRequestDepositFees = async function ({
  amount,
  approveAmount,
  client,
  owner,
  queryClient,
  stakingVaultAddress,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  client: Client;
  owner: Address;
  queryClient: QueryClient;
  stakingVaultAddress: Address;
  token: Token;
}) {
  const approvalGasUnits = await estimateApprovalGasUnits({
    amount,
    approveAmount,
    client,
    owner,
    queryClient,
    spender: stakingVaultAddress,
    token,
  });

  return fetchTotalNetworkFees({
    chain: getChainById(token.chainId),
    gasUnits: approvalGasUnits + requestDepositGasUnits,
    queryClient,
  });
};
