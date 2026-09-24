import type { Market } from "@morpho-org/blue-sdk";

import { applyBps, minBigInt } from "./bigint";

// Allow a small amount of interest to accrue before a full repayment is included.
const REPAYMENT_BUFFER_BPS = 100n;

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

export const isFullMaxRepayment = ({
  currentBorrowAssets,
  maxRepayable,
}: {
  maxRepayable: bigint | undefined;
  currentBorrowAssets: bigint | undefined;
}) =>
  currentBorrowAssets !== undefined &&
  maxRepayable !== undefined &&
  maxRepayable >= currentBorrowAssets;

export const getRepayShares = function ({
  amount,
  borrowAssets,
  borrowShares,
  isMaxRepayment,
  loanTokenBalance,
}: {
  amount: bigint;
  borrowAssets: bigint | undefined;
  borrowShares: bigint | undefined;
  isMaxRepayment: boolean;
  loanTokenBalance: bigint | undefined;
}) {
  const isFullRepayment =
    amount > 0n &&
    isMaxRepayment &&
    borrowAssets !== undefined &&
    borrowAssets > 0n &&
    borrowShares !== undefined &&
    borrowShares > 0n &&
    loanTokenBalance !== undefined &&
    loanTokenBalance >= borrowAssets;

  return isFullRepayment ? borrowShares : undefined;
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

export const getRepayApprovalAmount = function ({
  amount,
  loanTokenBalance,
  shares,
}: {
  amount: bigint;
  loanTokenBalance: bigint | undefined;
  shares: bigint | undefined;
}) {
  if (shares === undefined) {
    return amount;
  }

  const bufferedAmount = amount + applyBps(amount, REPAYMENT_BUFFER_BPS);

  return loanTokenBalance === undefined
    ? bufferedAmount
    : minBigInt(bufferedAmount, loanTokenBalance);
};

export const getEffectiveRepaymentAssets = ({
  assets,
  totalBorrowAssets,
}: {
  assets: bigint;
  totalBorrowAssets: bigint;
}) => minBigInt(assets, totalBorrowAssets);

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
