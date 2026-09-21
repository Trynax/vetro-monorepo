import type { Hash, TransactionReceipt } from "viem";

type CommonEvents = {
  "unexpected-error": [Error];
};

type ApprovalEvents = {
  "approve-transaction-reverted": [TransactionReceipt];
  "approve-transaction-succeeded": [TransactionReceipt];
  "pre-approve": [];
  "user-signed-approval": [Hash];
  "user-signing-approval-error": [Error];
};

export type DepositEvents = ApprovalEvents &
  CommonEvents & {
    "deposit-failed": [Error];
    "deposit-failed-validation": [string];
    "deposit-settled": [];
    "deposit-transaction-reverted": [TransactionReceipt];
    "deposit-transaction-succeeded": [TransactionReceipt];
    "pre-deposit": [];
    "user-signed-deposit": [Hash];
    "user-signing-deposit-error": [Error];
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

export type RequestWithdrawEvents = CommonEvents & {
  "pre-request-withdraw": [];
  "request-withdraw-failed": [Error];
  "request-withdraw-failed-validation": [string];
  "request-withdraw-settled": [];
  "request-withdraw-transaction-reverted": [TransactionReceipt];
  "request-withdraw-transaction-succeeded": [TransactionReceipt];
  "user-signed-request-withdraw": [Hash];
  "user-signing-request-withdraw-error": [Error];
};

export type ClaimWithdrawEvents = CommonEvents & {
  "claim-withdraw-failed": [Error];
  "claim-withdraw-failed-validation": [string];
  "claim-withdraw-settled": [];
  "claim-withdraw-transaction-reverted": [TransactionReceipt];
  "claim-withdraw-transaction-succeeded": [TransactionReceipt];
  "pre-claim-withdraw": [];
  "user-signed-claim-withdraw": [Hash];
  "user-signing-claim-withdraw-error": [Error];
};

export type ClaimWithdrawBatchEvents = CommonEvents & {
  "claim-withdraw-batch-failed": [Error];
  "claim-withdraw-batch-failed-validation": [string];
  "claim-withdraw-batch-settled": [];
  "claim-withdraw-batch-transaction-reverted": [TransactionReceipt];
  "claim-withdraw-batch-transaction-succeeded": [TransactionReceipt];
  "pre-claim-withdraw-batch": [];
  "user-signed-claim-withdraw-batch": [Hash];
  "user-signing-claim-withdraw-batch-error": [Error];
};

export type CancelWithdrawEvents = CommonEvents & {
  "cancel-withdraw-failed": [Error];
  "cancel-withdraw-failed-validation": [string];
  "cancel-withdraw-settled": [];
  "cancel-withdraw-transaction-reverted": [TransactionReceipt];
  "cancel-withdraw-transaction-succeeded": [TransactionReceipt];
  "pre-cancel-withdraw": [];
  "user-signed-cancel-withdraw": [Hash];
  "user-signing-cancel-withdraw-error": [Error];
};

export type CooldownRequest = {
  assets: bigint;
  claimableAt: bigint;
  owner: `0x${string}`;
};
