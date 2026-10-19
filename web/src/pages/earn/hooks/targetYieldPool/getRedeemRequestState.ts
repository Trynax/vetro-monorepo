import type { RedeemRequest } from "fetchers/earn/targetYieldPool/fetchRedeemRequest";

type RedeemRequestState = {
  amount: bigint;
  canCancel: boolean;
  canClaim: boolean;
  shares: bigint;
  state: "claimable" | "none" | "pending";
};

export const getRedeemRequestState = function ({
  cancelableShares,
  claimableAssets,
  claimableShares,
  maxRedeemShares,
  pendingAssets,
  pendingShares,
}: RedeemRequest): RedeemRequestState {
  if (claimableShares > 0n) {
    return {
      amount: claimableAssets,
      canCancel: false,
      canClaim: maxRedeemShares > 0n,
      shares: claimableShares,
      state: "claimable",
    };
  }
  if (pendingShares > 0n) {
    return {
      amount: pendingAssets,
      canCancel: cancelableShares > 0n,
      canClaim: false,
      shares: pendingShares,
      state: "pending",
    };
  }
  return {
    amount: 0n,
    canCancel: false,
    canClaim: false,
    shares: 0n,
    state: "none",
  };
};
