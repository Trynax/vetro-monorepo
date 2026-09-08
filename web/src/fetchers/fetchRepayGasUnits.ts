import { tokenBalanceQueryOptions } from "@hemilabs/react-hooks/useTokenBalance";
import { getChainAddresses } from "@morpho-org/blue-sdk";
import type { QueryClient } from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { encodeRepayAssets } from "@vetro-protocol/morpho-blue-market/actions";
import { morphoMarketOptions } from "hooks/borrow/useMorphoMarket";
import { positionInfoOptions } from "hooks/borrow/usePositionInfo";
import { createErc20AllowanceStateOverride } from "utils/erc20StateOverride";
import { type Address, type Client, type Hash } from "viem";
import { estimateGas } from "viem/actions";

import { estimateApprovalGasUnits } from "./estimateApprovalGasUnits";

/**
 * Estimates gas units for a repay operation. Returns the total gas units
 * for the whole flow (approval + repay).
 * Throws if the amount exceeds the user's current debt or the required
 * approval amount exceeds the user's loan token balance.
 */
export const fetchRepayGasUnits = async function ({
  amount,
  approveAmount,
  client,
  marketId,
  owner,
  queryClient,
  shares,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  client: Client;
  marketId: Hash;
  owner: Address;
  queryClient: QueryClient;
  shares?: bigint;
  token: Token;
}) {
  const chainId = client.chain!.id;
  const morphoAddress = getChainAddresses(chainId).morpho;

  const [morphoMarket, position, loanBalance] = await Promise.all([
    queryClient.ensureQueryData(
      morphoMarketOptions({ chainId, client, marketId }),
    ),
    queryClient.ensureQueryData(
      positionInfoOptions({ account: owner, chainId, client, marketId }),
    ),
    queryClient.ensureQueryData(
      tokenBalanceQueryOptions({
        account: owner,
        client,
        token: { address: token.address, chainId },
      }),
    ),
  ]);

  const currentBorrowAssets = morphoMarket.toBorrowAssets(
    position.borrowShares,
  );

  if (amount > currentBorrowAssets) {
    throw new Error("Amount exceeds current debt");
  }

  const amountForApproval =
    shares === undefined ? amount : (approveAmount ?? amount);

  if (amountForApproval > loanBalance) {
    throw new Error("Insufficient loan token balance");
  }

  const [approvalGas, repayGas] = await Promise.all([
    estimateApprovalGasUnits({
      amount: amountForApproval,
      approveAmount,
      client,
      owner,
      queryClient,
      spender: morphoAddress,
      token,
    }),
    estimateGas(client, {
      account: owner,
      data: encodeRepayAssets({
        amount: shares === undefined ? amount : 0n,
        marketParams: morphoMarket.params,
        onBehalf: owner,
        shares,
      }),
      stateOverride: createErc20AllowanceStateOverride({
        owner,
        spender: morphoAddress,
        token,
      }),
      to: morphoAddress,
    }),
  ]);

  return approvalGas + repayGas;
};
