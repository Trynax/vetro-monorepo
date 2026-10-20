import { getChainAddresses } from "@morpho-org/blue-sdk";
import type { QueryClient } from "@tanstack/react-query";
import { encodeBorrowAssets } from "@vetro-protocol/morpho-blue-market/actions";
import { morphoMarketOptions } from "hooks/borrow/useMorphoMarket";
import { positionInfoOptions } from "hooks/borrow/usePositionInfo";
import { getMaxBorrowable } from "utils/borrowLimit";
import { type Address, type Client, type Hash } from "viem";
import { estimateGas } from "viem/actions";

/**
 * Estimates gas units for a borrow operation.
 * Throws if the amount exceeds the user's borrow limit.
 */
export const fetchBorrowGasUnits = async function ({
  amount,
  client,
  collateralInput = 0n,
  marketId,
  owner,
  queryClient,
  stateOverride,
}: {
  amount: bigint;
  client: Client;
  collateralInput?: bigint;
  marketId: Hash;
  owner: Address;
  queryClient: QueryClient;
  stateOverride?: Parameters<typeof estimateGas>[1]["stateOverride"];
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

  const maxBorrowableAmount = getMaxBorrowable({
    borrowShares: position.borrowShares,
    collateral: position.collateral + collateralInput,
    market: morphoMarket,
  });

  if (amount > maxBorrowableAmount) {
    throw new Error("Amount exceeds borrow limit");
  }

  return estimateGas(client, {
    account: owner,
    data: encodeBorrowAssets({
      amount,
      marketParams: morphoMarket.params,
      onBehalf: owner,
      receiver: owner,
    }),
    stateOverride,
    to: morphoAddress,
  });
};
