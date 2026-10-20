import { describe, expect, it } from "vitest";

import { getRedeemRequestState } from "./getRedeemRequestState";

const emptyRequest = {
  cancelableShares: 0n,
  claimableAssets: 0n,
  claimableShares: 0n,
  maxRedeemShares: 0n,
  pendingAssets: 0n,
  pendingShares: 0n,
};

describe("getRedeemRequestState", function () {
  it("has nothing to claim or cancel when there is no request", function () {
    expect(getRedeemRequestState(emptyRequest)).toEqual({
      amount: 0n,
      canCancel: false,
      canClaim: false,
      shares: 0n,
      state: "none",
    });
  });

  it("can cancel a pending request during the exit window", function () {
    expect(
      getRedeemRequestState({
        ...emptyRequest,
        cancelableShares: 495n,
        pendingAssets: 500n,
        pendingShares: 495n,
      }),
    ).toEqual({
      amount: 500n,
      canCancel: true,
      canClaim: false,
      shares: 495n,
      state: "pending",
    });
  });

  it("cannot cancel a pending request after the term ends", function () {
    expect(
      getRedeemRequestState({
        ...emptyRequest,
        pendingAssets: 500n,
        pendingShares: 495n,
      }),
    ).toEqual({
      amount: 500n,
      canCancel: false,
      canClaim: false,
      shares: 495n,
      state: "pending",
    });
  });

  it("can claim but not cancel a claimable request", function () {
    expect(
      getRedeemRequestState({
        ...emptyRequest,
        claimableAssets: 505n,
        claimableShares: 495n,
        maxRedeemShares: 495n,
      }),
    ).toEqual({
      amount: 505n,
      canCancel: false,
      canClaim: true,
      shares: 495n,
      state: "claimable",
    });
  });

  it("cannot claim a claimable request while the vault is shut down", function () {
    expect(
      getRedeemRequestState({ ...emptyRequest, claimableShares: 495n }),
    ).toEqual({
      amount: 0n,
      canCancel: false,
      canClaim: false,
      shares: 495n,
      state: "claimable",
    });
  });
});
