import type { Address } from "viem";

export type DepositRequest = {
  cancelableAssets: bigint;
  claimableAssets: bigint;
  claimableShares: bigint;
  maxDepositAssets: bigint;
  pendingAssets: bigint;
};

// TODO: read with `getPendingDepositRequest`, `getClaimableDepositRequest`,
// `getMaxMint` and `getCancelableDepositRequest` from
// `@vetro-protocol/target-yield-earn`, and `maxDeposit` from
// `viem-erc7540/actions`, once VUSDx is deployed.
// See https://github.com/vetro-protocol/vetro-monorepo/issues/646
export const fetchDepositRequest = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _: { controller: Address; stakingVaultAddress: Address },
): Promise<DepositRequest> => ({
  cancelableAssets: 0n,
  claimableAssets: 0n,
  claimableShares: 0n,
  maxDepositAssets: 0n,
  pendingAssets: 0n,
});
