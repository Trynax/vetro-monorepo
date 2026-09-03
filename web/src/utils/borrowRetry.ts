export type BorrowRetryState = {
  action: "borrow-more" | "supply-and-borrow";
  flowStatus: "approving" | "borrowing" | "supply-collateral-ready";
};

export const getBorrowRetryState = function ({
  startedWithApproval,
  supplyCollateralSucceeded,
}: {
  startedWithApproval: boolean;
  supplyCollateralSucceeded: boolean;
}): BorrowRetryState {
  if (supplyCollateralSucceeded) {
    return {
      action: "borrow-more",
      flowStatus: "borrowing",
    };
  }

  return {
    action: "supply-and-borrow",
    flowStatus: startedWithApproval ? "approving" : "supply-collateral-ready",
  };
};
