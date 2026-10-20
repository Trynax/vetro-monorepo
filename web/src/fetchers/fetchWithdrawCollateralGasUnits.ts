import { getChainAddresses } from "@morpho-org/blue-sdk";
import type { QueryClient } from "@tanstack/react-query";
import { encodeWithdrawCollateral } from "@vetro-protocol/morpho-blue-market/actions";
import { morphoMarketOptions } from "hooks/borrow/useMorphoMarket";
import { positionInfoOptions } from "hooks/borrow/usePositionInfo";
import { type Address, type Client, type Hash } from "viem";
import { estimateGas } from "viem/actions";

/**
 * Estimates gas units for a withdraw collateral operation.
 * Throws if the amount exceeds the user's withdrawable collateral.
 */
export const fetchWithdrawCollateralGasUnits = async function ({
  amount,
  client,
  marketId,
  owner,
  queryClient,
}: {
  amount: bigint;
  client: Client;
  marketId: Hash;
  owner: Address;
  queryClient: QueryClient;
}) {
  const chainId = client.chain!.id;
  const morphoAddress = getChainAddresses(chainId).blue;

  const [morphoMarket, position] = await Promise.all([
    queryClient.ensureQueryData(
      morphoMarketOptions({ chainId, client, marketId }),
    ),
    queryClient.ensureQueryData(
      positionInfoOptions({ account: owner, chainId, client, marketId }),
    ),
  ]);

  if (amount > (position?.withdrawableCollateral ?? 0n)) {
    throw new Error("Amount exceeds withdrawable collateral");
  }

  return estimateGas(client, {
    account: owner,
    data: encodeWithdrawCollateral({
      amount,
      marketParams: morphoMarket.params,
      onBehalf: owner,
      receiver: owner,
    }),
    to: morphoAddress,
  });
};
