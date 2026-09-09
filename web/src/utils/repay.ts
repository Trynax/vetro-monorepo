import type { Market } from "@morpho-org/blue-sdk";

import { BPS_DENOMINATOR } from "./bigint";

// Treat repayments of at least 99% of the debt as an intent to close it fully.
const FULL_REPAYMENT_THRESHOLD_BPS = 9900n;

export const getCurrentBorrowAssets = function ({
  borrowShares,
  market,
}: {
  borrowShares: bigint | undefined;
  market: Market | undefined;
}) {
  if (market === undefined || borrowShares === undefined) {
    return undefined;
  }

  return market.toBorrowAssets(borrowShares);
};

export const getRepayShares = function ({
  amount,
  borrowAssets,
  borrowShares,
  loanTokenBalance,
}: {
  amount: bigint;
  borrowAssets: bigint | undefined;
  borrowShares: bigint | undefined;
  loanTokenBalance: bigint | undefined;
}) {
  const isNearFullRepayment =
    amount > 0n &&
    borrowAssets !== undefined &&
    borrowAssets > 0n &&
    borrowShares !== undefined &&
    borrowShares > 0n &&
    loanTokenBalance !== undefined &&
    loanTokenBalance >= borrowAssets &&
    amount * BPS_DENOMINATOR >= borrowAssets * FULL_REPAYMENT_THRESHOLD_BPS;

  return isNearFullRepayment ? borrowShares : undefined;
};

export const getMaxRepayable = function ({
  borrowShares,
  loanTokenBalance,
  market,
}: {
  borrowShares: bigint | undefined;
  loanTokenBalance: bigint | undefined;
  market: Market | undefined;
}) {
  if (
    market === undefined ||
    borrowShares === undefined ||
    loanTokenBalance === undefined
  ) {
    return undefined;
  }

  return market.getRepayCapacityLimit(borrowShares, loanTokenBalance).value;
};

export const getRepayApprovalAmount = ({
  amount,
  loanTokenBalance,
  shares,
}: {
  amount: bigint;
  loanTokenBalance: bigint | undefined;
  shares: bigint | undefined;
}) => (shares === undefined ? amount : (loanTokenBalance ?? amount));

export const getRepayPositionArgs = ({
  assets,
  repayShares,
  shares,
}: {
  assets: bigint;
  repayShares: bigint | undefined;
  shares: bigint;
}) =>
  repayShares === undefined ? { assets, shares: 0n } : { assets: 0n, shares };
