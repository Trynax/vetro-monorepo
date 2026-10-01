import { useQueries } from "@tanstack/react-query";
import { stakingVaultAddresses } from "@vetro-protocol/earn";
import { useEthereumClient } from "hooks/useEthereumClient";
import { mainnet } from "networks/mainnet";
import { useAccount } from "wagmi";

import { canInstantWithdrawOptions } from "./useCanInstantWithdraw";

export function useShowExitTickets() {
  const { address: account } = useAccount();
  const client = useEthereumClient();

  return useQueries({
    // Show the exit tickets section when at least one vault cannot
    // instant-withdraw, since that vault requires the non-instant
    // request flow that produces exit tickets. The loading state is
    // exposed separately via `isLoading` so the caller can show a
    // skeleton while the checks resolve.
    combine: (results) => ({
      data: results.some((result) => result.data === false),
      isLoading: results.some((result) => result.isLoading),
    }),
    queries: stakingVaultAddresses.map((stakingVaultAddress) =>
      canInstantWithdrawOptions({
        account,
        chainId: mainnet.id,
        client,
        stakingVaultAddress,
      }),
    ),
  });
}
