import type { Client } from "viem";

import {
  getCancelableDepositRequest,
  getClaimableDepositRequest,
  getEpoch,
  getEpochId,
  getIsPaused,
  getIsShutdown,
  getIsTerminated,
  getMaxMint,
  getMaxRequestDeposit,
  getMaxRequestRedeem,
  getPendingDepositRequest,
  getRate,
} from "./actions/public/index.ts";

export { targetYieldEarnVaultAbi } from "./abi/targetYieldEarnVaultAbi.ts";

export {
  maxExitWindowSeconds,
  minEpochDurationSeconds,
  minExitWindowSeconds,
} from "./constants.ts";

export {
  targetYieldVaultAddresses,
  vusdxAddress,
} from "./targetYieldVaultAddresses.ts";

// Export factory functions for .extend() pattern
export const targetYieldEarnPublicActions = () => (client: Client) => ({
  getCancelableDepositRequest: (
    params: Parameters<typeof getCancelableDepositRequest>[1],
  ) => getCancelableDepositRequest(client, params),
  getClaimableDepositRequest: (
    params: Parameters<typeof getClaimableDepositRequest>[1],
  ) => getClaimableDepositRequest(client, params),
  getEpoch: (params: Parameters<typeof getEpoch>[1]) =>
    getEpoch(client, params),
  getEpochId: (params: Parameters<typeof getEpochId>[1]) =>
    getEpochId(client, params),
  getIsPaused: (params: Parameters<typeof getIsPaused>[1]) =>
    getIsPaused(client, params),
  getIsShutdown: (params: Parameters<typeof getIsShutdown>[1]) =>
    getIsShutdown(client, params),
  getIsTerminated: (params: Parameters<typeof getIsTerminated>[1]) =>
    getIsTerminated(client, params),
  getMaxMint: (params: Parameters<typeof getMaxMint>[1]) =>
    getMaxMint(client, params),
  getMaxRequestDeposit: (params: Parameters<typeof getMaxRequestDeposit>[1]) =>
    getMaxRequestDeposit(client, params),
  getMaxRequestRedeem: (params: Parameters<typeof getMaxRequestRedeem>[1]) =>
    getMaxRequestRedeem(client, params),
  getPendingDepositRequest: (
    params: Parameters<typeof getPendingDepositRequest>[1],
  ) => getPendingDepositRequest(client, params),
  getRate: (params: Parameters<typeof getRate>[1]) => getRate(client, params),
});
