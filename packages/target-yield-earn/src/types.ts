import type { Hash, TransactionReceipt } from "viem";

type CommonEvents = {
  "unexpected-error": [Error];
};

export type CancelDepositRequestEvents = CommonEvents & {
  "cancel-deposit-request-failed": [Error];
  "cancel-deposit-request-failed-validation": [string];
  "cancel-deposit-request-settled": [];
  "cancel-deposit-request-transaction-reverted": [TransactionReceipt];
  "cancel-deposit-request-transaction-succeeded": [TransactionReceipt];
  "pre-cancel-deposit-request": [];
  "user-signed-cancel-deposit-request": [Hash];
  "user-signing-cancel-deposit-request-error": [Error];
};

export type CancelRedeemRequestEvents = CommonEvents & {
  "cancel-redeem-request-failed": [Error];
  "cancel-redeem-request-failed-validation": [string];
  "cancel-redeem-request-settled": [];
  "cancel-redeem-request-transaction-reverted": [TransactionReceipt];
  "cancel-redeem-request-transaction-succeeded": [TransactionReceipt];
  "pre-cancel-redeem-request": [];
  "user-signed-cancel-redeem-request": [Hash];
  "user-signing-cancel-redeem-request-error": [Error];
};

export type ClaimDepositEvents = CommonEvents & {
  "claim-deposit-failed": [Error];
  "claim-deposit-failed-validation": [string];
  "claim-deposit-settled": [];
  "claim-deposit-transaction-reverted": [TransactionReceipt];
  "claim-deposit-transaction-succeeded": [TransactionReceipt];
  "pre-claim-deposit": [];
  "user-signed-claim-deposit": [Hash];
  "user-signing-claim-deposit-error": [Error];
};

type ApprovalEvents = {
  "approve-transaction-reverted": [TransactionReceipt];
  "approve-transaction-succeeded": [TransactionReceipt];
  "pre-approve": [];
  "user-signed-approval": [Hash];
  "user-signing-approval-error": [Error];
};

export type RequestDepositEvents = ApprovalEvents &
  CommonEvents & {
    "pre-request-deposit": [];
    "request-deposit-failed": [Error];
    "request-deposit-failed-validation": [string];
    "request-deposit-settled": [];
    "request-deposit-transaction-reverted": [TransactionReceipt];
    "request-deposit-transaction-succeeded": [TransactionReceipt];
    "user-signed-request-deposit": [Hash];
    "user-signing-request-deposit-error": [Error];
  };

export type RequestRedeemEvents = CommonEvents & {
  "pre-request-redeem": [];
  "request-redeem-failed": [Error];
  "request-redeem-failed-validation": [string];
  "request-redeem-settled": [];
  "request-redeem-transaction-reverted": [TransactionReceipt];
  "request-redeem-transaction-succeeded": [TransactionReceipt];
  "user-signed-request-redeem": [Hash];
  "user-signing-request-redeem-error": [Error];
};
