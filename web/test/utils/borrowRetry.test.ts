import { describe, expect, it } from "vitest";

import { getBorrowRetryState } from "../../src/utils/borrowRetry";

describe("getBorrowRetryState", function () {
  it("retries the combined flow from the supply step when approval was not needed", function () {
    expect(
      getBorrowRetryState({
        startedWithApproval: false,
        supplyCollateralSucceeded: false,
      }),
    ).toEqual({
      action: "supply-and-borrow",
      flowStatus: "supply-collateral-ready",
    });
  });

  it("retries approval before restarting the combined flow when approval was needed", function () {
    expect(
      getBorrowRetryState({
        startedWithApproval: true,
        supplyCollateralSucceeded: false,
      }),
    ).toEqual({
      action: "supply-and-borrow",
      flowStatus: "approving",
    });
  });

  it("retries borrowing only after collateral supply succeeds", function () {
    expect(
      getBorrowRetryState({
        startedWithApproval: true,
        supplyCollateralSucceeded: true,
      }),
    ).toEqual({
      action: "borrow-more",
      flowStatus: "borrowing",
    });
  });
});
