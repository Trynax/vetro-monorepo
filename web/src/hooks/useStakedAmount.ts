import {
  type UseQueryResult,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import { useEthereumClient } from "hooks/useEthereumClient";
import { stakedBalanceQueryOptions } from "hooks/useStakedBalance";
import { vaultPeggedTokenQueryOptions } from "hooks/useVaultPeggedToken";
import { mainnet } from "networks/mainnet";
import type { TokenWithGateway } from "types";
import { combineQueryResults } from "utils/queries";
import type { Address } from "viem";
import { useAccount } from "wagmi";

const combineStakedAmount = (
  results: [UseQueryResult<TokenWithGateway>, UseQueryResult<bigint>],
) =>
  combineQueryResults({
    results,
    select: ([peggedToken, stakedBalance]) => ({ peggedToken, stakedBalance }),
  });

export function useStakedAmount(stakingVaultAddress: Address) {
  const { address: account } = useAccount();
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  return useQueries({
    combine: combineStakedAmount,
    queries: [
      vaultPeggedTokenQueryOptions({
        client,
        queryClient,
        stakingVaultAddress,
      }),
      stakedBalanceQueryOptions({
        account,
        chainId: mainnet.id,
        client,
        queryClient,
        stakingVaultAddress,
      }),
    ],
  });
}
