import { tokenBalanceQueryOptions } from "@hemilabs/react-hooks/useTokenBalance";
import { getChainAddresses } from "@morpho-org/blue-sdk";
import type { QueryClient } from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { encodeSupplyCollateral } from "@vetro-protocol/morpho-blue-market/actions";
import { morphoMarketOptions } from "hooks/borrow/useMorphoMarket";
import { createErc20AllowanceStateOverride } from "utils/erc20StateOverride";
import { type Address, type Client, type Hash } from "viem";
import { estimateGas } from "viem/actions";

import { estimateApprovalGasUnits } from "./estimateApprovalGasUnits";

/**
 * Estimates gas units for a supply collateral operation. Returns the total gas units
 * for the whole flow (approval + supply collateral).
 * Throws if the amount exceeds the user's collateral token balance.
 */
export const fetchSupplyCollateralGasUnits = async function ({
  amount,
  approveAmount,
  client,
  marketId,
  owner,
  queryClient,
  token,
}: {
  amount: bigint;
  approveAmount: bigint | undefined;
  client: Client;
  marketId: Hash;
  owner: Address;
  queryClient: QueryClient;
  token: Token;
}) {
  const chainId = client.chain!.id;
  const morphoAddress = getChainAddresses(chainId).blue;

  // Fire morphoMarket fetch early but don't block on it yet
  const morphoMarketPromise = queryClient.ensureQueryData(
    morphoMarketOptions({ chainId, client, marketId }),
  );

  const collateralBalance = await queryClient.ensureQueryData(
    tokenBalanceQueryOptions({
      account: owner,
      client,
      token: { address: token.address, chainId },
    }),
  );

  if (amount > collateralBalance) {
    throw new Error("Insufficient collateral token balance");
  }

  const [approvalGas, supplyGas] = await Promise.all([
    estimateApprovalGasUnits({
      amount,
      approveAmount,
      client,
      owner,
      queryClient,
      spender: morphoAddress,
      token,
    }),
    morphoMarketPromise.then((morphoMarket) =>
      estimateGas(client, {
        account: owner,
        data: encodeSupplyCollateral({
          amount,
          marketParams: morphoMarket.params,
          onBehalf: owner,
        }),
        stateOverride: createErc20AllowanceStateOverride({
          owner,
          spender: morphoAddress,
          token,
        }),
        to: morphoAddress,
      }),
    ),
  ]);

  return approvalGas + supplyGas;
};
