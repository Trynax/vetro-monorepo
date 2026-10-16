import type { Client } from "viem";

import {
  claimableDepositRequest,
  getCancelableDepositRequest,
  getEpoch,
  getEpochId,
  getIsPaused,
  getIsShutdown,
  getIsTerminated,
  getMaxRequestDeposit,
  getMaxRequestRedeem,
  getRate,
  maxMint,
  pendingDepositRequest,
} from "./actions/public/index.ts";

export { targetYieldEarnVaultAbi } from "./abi/targetYieldEarnVaultAbi.ts";

export {
  maxExitWindowSeconds,
  minEpochDurationSeconds,
  minExitWindowSeconds,
} from "./constants.ts";

// Export factory functions for .extend() pattern
export const targetYieldEarnPublicActions = () => (client: Client) => ({
  claimableDepositRequest: (
    params: Parameters<typeof claimableDepositRequest>[1],
  ) => claimableDepositRequest(client, params),
  getCancelableDepositRequest: (
    params: Parameters<typeof getCancelableDepositRequest>[1],
  ) => getCancelableDepositRequest(client, params),
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
  getMaxRequestDeposit: (params: Parameters<typeof getMaxRequestDeposit>[1]) =>
    getMaxRequestDeposit(client, params),
  getMaxRequestRedeem: (params: Parameters<typeof getMaxRequestRedeem>[1]) =>
    getMaxRequestRedeem(client, params),
  getRate: (params: Parameters<typeof getRate>[1]) => getRate(client, params),
  maxMint: (params: Parameters<typeof maxMint>[1]) => maxMint(client, params),
  pendingDepositRequest: (
    params: Parameters<typeof pendingDepositRequest>[1],
  ) => pendingDepositRequest(client, params),
});
