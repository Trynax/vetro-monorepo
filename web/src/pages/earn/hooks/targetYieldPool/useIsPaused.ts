import { queryOptions } from "@tanstack/react-query";
import type { Address } from "viem";

export const isPausedOptions = (stakingVaultAddress: Address) =>
  queryOptions({
    // TODO: read with `getIsPaused` from `@vetro-protocol/target-yield-earn` once
    // VUSDx is deployed.
    // See https://github.com/vetro-protocol/vetro-monorepo/issues/646
    queryFn: () => Promise.resolve(false),
    queryKey: ["target-yield-pool-is-paused", stakingVaultAddress],
  });
