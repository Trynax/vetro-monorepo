import {
  targetYieldVaultAddresses as coreTargetYieldVaultAddresses,
  vusdxAddress as coreVusdxAddress,
} from "@vetro-protocol/core";
import type { Address } from "viem";

// Re-declared rather than re-exported: `export … from` emits the same
// re-export into the .d.ts, pointing consumers at a package private to this
// monorepo. The explicit annotations keep the declarations self-contained.
export const vusdxAddress: Address = coreVusdxAddress;

export const targetYieldVaultAddresses: Address[] =
  coreTargetYieldVaultAddresses;
