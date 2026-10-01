import { useQuery } from "@tanstack/react-query";
import fetch from "fetch-plus-plus";
import { mainnet } from "networks/mainnet";
import type { Address } from "viem";

const apiUrl = import.meta.env.VITE_VETRO_API_URL;

type ExitQueueResponse = {
  assets: string;
  openTickets: number;
};

export const useVariableStakeExitQueue = (
  gatewayAddress: Address | undefined,
) =>
  useQuery({
    enabled:
      apiUrl !== undefined &&
      URL.canParse(apiUrl) &&
      gatewayAddress !== undefined,
    async queryFn() {
      const { assets, openTickets } = await (fetch(
        `${apiUrl}/variable-stake/exit-queue/${gatewayAddress}`,
      ) as Promise<ExitQueueResponse>);
      return {
        assetsInCooldown: BigInt(assets),
        openTickets,
      };
    },
    queryKey: ["variable-stake-exit-queue", mainnet.id, gatewayAddress],
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
