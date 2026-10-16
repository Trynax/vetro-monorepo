import type { DepositRequest } from "fetchers/earn/targetYieldPool/fetchDepositRequest";

type DepositRequestState = {
  amount: bigint;
  canCancel: boolean;
  canClaim: boolean;
  shares: bigint;
  state: "claimable" | "none" | "pending";
};

export const getDepositRequestState = function ({
  cancelableAssets,
  claimableAssets,
  claimableShares,
  maxDepositAssets,
  pendingAssets,
}: DepositRequest): DepositRequestState {
  if (claimableAssets > 0n) {
    return {
      amount: claimableAssets,
      canCancel: false,
      canClaim: maxDepositAssets > 0n,
      shares: claimableShares,
      state: "claimable",
    };
  }
  if (pendingAssets > 0n) {
    return {
      amount: pendingAssets,
      canCancel: cancelableAssets > 0n,
      canClaim: false,
      shares: 0n,
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
