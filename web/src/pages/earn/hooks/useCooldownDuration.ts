import { useQuery } from "@tanstack/react-query";
import { getCooldownDuration } from "@vetro-protocol/earn/actions";
import { useEthereumClient } from "hooks/useEthereumClient";
import { mainnet } from "networks/mainnet";
import type { Address } from "viem";

export function useCooldownDuration(stakingVaultAddress: Address) {
  const client = useEthereumClient();

  return useQuery({
    enabled: !!client,
    queryFn: () =>
      getCooldownDuration(client!, { address: stakingVaultAddress }),
    queryKey: ["cooldown-duration", mainnet.id, stakingVaultAddress],
    select: (data) => Math.round(Number(data) / 86400),
  });
}
