import type { Address } from "viem";

export type RedeemRequest = {
  cancelableShares: bigint;
  claimableAssets: bigint;
  claimableShares: bigint;
  maxRedeemShares: bigint;
  pendingAssets: bigint;
  pendingShares: bigint;
};

// TODO: read with new `getPendingRedeemRequest`, `getClaimableRedeemRequest`
// and `getCancelableRedeemRequest` in `@vetro-protocol/target-yield-earn`,
// and `convertToAssets`, `maxRedeem` and `maxWithdraw` from
// `viem-erc7540/actions`, once VUSDx is deployed.
// See https://github.com/vetro-protocol/vetro-monorepo/issues/646
export const fetchRedeemRequest = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _: { controller: Address; stakingVaultAddress: Address },
): Promise<RedeemRequest> => ({
  cancelableShares: 0n,
  claimableAssets: 0n,
  claimableShares: 0n,
  maxRedeemShares: 0n,
  pendingAssets: 0n,
  pendingShares: 0n,
});
