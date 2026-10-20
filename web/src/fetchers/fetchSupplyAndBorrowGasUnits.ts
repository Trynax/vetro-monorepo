import { getChainAddresses } from "@morpho-org/blue-sdk";
import type { QueryClient } from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { createMorphoCollateralStateOverride } from "utils/morphoStateOverride";
import { type Address, type Client, type Hash } from "viem";

import { fetchBorrowGasUnits } from "./fetchBorrowGasUnits";
import { fetchSupplyCollateralGasUnits } from "./fetchSupplyCollateralGasUnits";

/**
 * Estimates gas units for a supply collateral + borrow operation. Returns the total
 * gas units for the whole flow (approval + supply collateral + borrow).
 */
export const fetchSupplyAndBorrowGasUnits = async function ({
  approveAmount,
  borrowAmount,
  client,
  collateralAmount,
  collateralToken,
  marketId,
  owner,
  queryClient,
}: {
  approveAmount: bigint | undefined;
  borrowAmount: bigint;
  client: Client;
  collateralAmount: bigint;
  collateralToken: Token;
  marketId: Hash;
  owner: Address;
  queryClient: QueryClient;
}) {
  const [supplyGas, borrowGas] = await Promise.all([
    fetchSupplyCollateralGasUnits({
      amount: collateralAmount,
      approveAmount,
      client,
      marketId,
      owner,
      queryClient,
      token: collateralToken,
    }),
    fetchBorrowGasUnits({
      amount: borrowAmount,
      client,
      collateralInput: collateralAmount,
      marketId,
      owner,
      queryClient,
      stateOverride: createMorphoCollateralStateOverride({
        collateralAmount,
        marketId,
        morphoAddress: getChainAddresses(client.chain!.id).blue,
        user: owner,
      }),
    }),
  ]);

  return supplyGas + borrowGas;
};
