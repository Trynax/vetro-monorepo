import type { Market } from "@morpho-org/blue-sdk";
import { describe, expect, it, vi } from "vitest";

import {
  getMaxRepayable,
  getRepayApprovalAmount,
  getRepayShares,
} from "../../src/utils/repay";

describe("getRepayShares", function () {
  const repayment = {
    borrowAssets: 1000n,
    borrowShares: 500n,
    loanTokenBalance: 1000n,
  };

  it("returns the borrow shares for a near-full repayment", function () {
    expect(
      getRepayShares({
        ...repayment,
        amount: 990n,
      }),
    ).toBe(repayment.borrowShares);
  });

  it("keeps an ordinary partial repayment asset-based", function () {
    expect(
      getRepayShares({
        ...repayment,
        amount: 989n,
      }),
    ).toBeUndefined();
  });

  it("does not use shares when the wallet cannot cover the debt", function () {
    expect(
      getRepayShares({
        ...repayment,
        amount: 990n,
        loanTokenBalance: 999n,
      }),
    ).toBeUndefined();
  });
});

describe("getRepayApprovalAmount", function () {
  it("uses the input amount for an asset-based repayment", function () {
    expect(
      getRepayApprovalAmount({
        amount: 100n,
        loanTokenBalance: 1000n,
        shares: undefined,
      }),
    ).toBe(100n);
  });

  it("uses the wallet balance for a share-based repayment", function () {
    expect(
      getRepayApprovalAmount({
        amount: 990n,
        loanTokenBalance: 1000n,
        shares: 500n,
      }),
    ).toBe(1000n);
  });
});

describe("getMaxRepayable", function () {
  it("uses the market repayment capacity", function () {
    const getRepayCapacityLimit = vi.fn().mockReturnValue({ value: 900n });

    expect(
      getMaxRepayable({
        borrowShares: 500n,
        loanTokenBalance: 1000n,
        market: { getRepayCapacityLimit } as unknown as Market,
      }),
    ).toBe(900n);
    expect(getRepayCapacityLimit).toHaveBeenCalledWith(500n, 1000n);
  });

  it("waits for the repayment data before enabling MAX", function () {
    expect(
      getMaxRepayable({
        borrowShares: undefined,
        loanTokenBalance: 1000n,
        market: undefined,
      }),
    ).toBeUndefined();
  });
});
