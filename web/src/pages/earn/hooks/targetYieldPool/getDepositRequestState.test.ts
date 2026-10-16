import { describe, expect, it } from "vitest";

import { getDepositRequestState } from "./getDepositRequestState";

const emptyRequest = {
  cancelableAssets: 0n,
  claimableAssets: 0n,
  claimableShares: 0n,
  maxDepositAssets: 0n,
  pendingAssets: 0n,
};

describe("getDepositRequestState", function () {
  it("has nothing to claim or cancel when there is no request", function () {
    expect(getDepositRequestState(emptyRequest)).toEqual({
      amount: 0n,
      canCancel: false,
      canClaim: false,
      shares: 0n,
      state: "none",
    });
  });

  it("can cancel a pending request that is cancelable", function () {
    expect(
      getDepositRequestState({
        ...emptyRequest,
        cancelableAssets: 500n,
        pendingAssets: 500n,
      }),
    ).toEqual({
      amount: 500n,
      canCancel: true,
      canClaim: false,
      shares: 0n,
      state: "pending",
    });
  });

  it("cannot cancel a pending request that is not cancelable", function () {
    expect(
      getDepositRequestState({ ...emptyRequest, pendingAssets: 500n }),
    ).toEqual({
      amount: 500n,
      canCancel: false,
      canClaim: false,
      shares: 0n,
      state: "pending",
    });
  });

  it("can claim but not cancel a claimable request", function () {
    expect(
      getDepositRequestState({
        ...emptyRequest,
        cancelableAssets: 500n,
        claimableAssets: 500n,
        claimableShares: 495n,
        maxDepositAssets: 500n,
      }),
    ).toEqual({
      amount: 500n,
      canCancel: false,
      canClaim: true,
      shares: 495n,
      state: "claimable",
    });
  });

  it("cannot claim a claimable request while the vault is shut down", function () {
    expect(
      getDepositRequestState({ ...emptyRequest, claimableAssets: 500n }),
    ).toEqual({
      amount: 500n,
      canCancel: false,
      canClaim: false,
      shares: 0n,
      state: "claimable",
    });
  });

  it("can claim a claimable request that rounds down to zero shares", function () {
    expect(
      getDepositRequestState({
        ...emptyRequest,
        claimableAssets: 3n,
        maxDepositAssets: 3n,
      }),
    ).toEqual({
      amount: 3n,
      canCancel: false,
      canClaim: true,
      shares: 0n,
      state: "claimable",
    });
  });
});
