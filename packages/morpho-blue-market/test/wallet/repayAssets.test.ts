import {
  type Address,
  type Hash,
  type TransactionReceipt,
  type WalletClient,
  zeroAddress,
  zeroHash,
} from "viem";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "viem/actions";
import { sepolia } from "viem/chains";
import { allowance, approve } from "viem-erc20/actions";
import { describe, expect, it, vi } from "vitest";

import { repayAssets } from "../../src/actions/wallet/repayAssets.ts";

vi.mock("viem/actions", () => ({
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  writeContract: vi.fn(),
}));

vi.mock("viem-erc20/actions", () => ({
  allowance: vi.fn(),
  approve: vi.fn(),
}));

const mockWalletClient = {
  account: {
    address: "0x1111111111111111111111111111111111111111" as Address,
  },
  chain: sepolia,
} as unknown as WalletClient;

const mockMarketParams = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // loanToken
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", // collateralToken
  "0xcccccccccccccccccccccccccccccccccccccccc", // oracle
  "0xdddddddddddddddddddddddddddddddddddddd", // irm
  BigInt(900000000000000000), // lltv
] as const;

const validParameters = {
  address: "0x3333333333333333333333333333333333333333" as Address,
  amount: BigInt(1000),
  marketId:
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
  onBehalf: "0x1111111111111111111111111111111111111111" as Address,
};

describe("repayAssets", function () {
  it("should emit 'repay-assets-failed-validation' if client is not defined", async function () {
    const { emitter, promise } = repayAssets(
      // @ts-expect-error - Testing invalid input
      undefined,
      validParameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Client is not defined",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if client.account is not defined", async function () {
    const clientWithoutAccount = {
      chain: sepolia,
    } as unknown as WalletClient;

    const { emitter, promise } = repayAssets(
      clientWithoutAccount,
      validParameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Client must have an account",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' when client chain is not defined", async function () {
    const clientWithoutChain = {
      account: mockWalletClient.account,
    } as WalletClient;

    const { emitter, promise } = repayAssets(
      clientWithoutChain,
      validParameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Chain is not defined on wallet client",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if Morpho address is invalid", async function () {
    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      // @ts-expect-error - Testing invalid input
      address: "invalid",
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid Morpho address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if Morpho address is zero address", async function () {
    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      address: zeroAddress,
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid Morpho address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if market ID is zero hash", async function () {
    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      marketId: zeroHash,
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Market ID cannot be empty or zero",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if onBehalf address is invalid", async function () {
    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      // @ts-expect-error - Testing invalid input
      onBehalf: "invalid",
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid onBehalf address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if onBehalf address is zero address", async function () {
    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      onBehalf: zeroAddress,
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid onBehalf address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if amount is not a bigint", async function () {
    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      // @ts-expect-error - Testing invalid input
      amount: 1000,
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Amount must be a bigint",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if amount is zero", async function () {
    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      amount: BigInt(0),
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Amount must be greater than 0",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if amount is negative", async function () {
    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      amount: BigInt(-1),
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Amount must be greater than 0",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if approveAmount is not a bigint", async function () {
    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      // @ts-expect-error - Testing invalid input
      approveAmount: 1000,
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Approve amount must be a bigint",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed-validation' if approveAmount is less than amount", async function () {
    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      approveAmount: validParameters.amount - BigInt(1),
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("repay-assets-failed-validation", onFailedValidation);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Approve amount must be greater than or equal to amount",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should skip approval if allowance is sufficient and proceed to repay", async function () {
    const receipt = {
      status: "success",
    } as TransactionReceipt;

    vi.mocked(readContract).mockResolvedValue(mockMarketParams);
    vi.mocked(allowance).mockResolvedValue(validParameters.amount);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = repayAssets(mockWalletClient, validParameters);

    const onPreApprove = vi.fn();
    const onPreRepayAssets = vi.fn();
    const onUserSignedRepayAssets = vi.fn();
    const onRepayAssetsTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("pre-repay-assets", onPreRepayAssets);
    emitter.on("user-signed-repay-assets", onUserSignedRepayAssets);
    emitter.on(
      "repay-assets-transaction-succeeded",
      onRepayAssetsTransactionSucceeded,
    );
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onPreApprove).not.toHaveBeenCalled();
    expect(onPreRepayAssets).toHaveBeenCalledOnce();
    expect(onUserSignedRepayAssets).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onRepayAssetsTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(
      receipt,
    );
    expect(approve).not.toHaveBeenCalled();
    expect(writeContract).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should repay by shares when shares are provided", async function () {
    const receipt = {
      status: "success",
    } as TransactionReceipt;
    const shares = 500n;
    const approveAmount = 1200n;

    vi.mocked(readContract).mockResolvedValue(mockMarketParams);
    vi.mocked(allowance).mockResolvedValue(validParameters.amount);
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt)
      .mockResolvedValueOnce(receipt)
      .mockResolvedValueOnce(receipt);

    const { promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      approveAmount,
      shares,
    });

    await promise;

    expect(approve).toHaveBeenCalledWith(
      mockWalletClient,
      expect.objectContaining({
        amount: approveAmount,
      }),
    );
    expect(writeContract).toHaveBeenCalledWith(
      mockWalletClient,
      expect.objectContaining({
        args: [
          expect.objectContaining({
            collateralToken: mockMarketParams[1],
            irm: mockMarketParams[3],
            lltv: mockMarketParams[4],
            loanToken: mockMarketParams[0],
            oracle: mockMarketParams[2],
          }),
          0n,
          shares,
          validParameters.onBehalf,
          "0x",
        ],
      }),
    );
  });

  it("should approve first if allowance is insufficient, then repay", async function () {
    const successReceipt = {
      status: "success",
    } as TransactionReceipt;

    vi.mocked(readContract).mockResolvedValue(mockMarketParams);
    vi.mocked(allowance).mockResolvedValue(validParameters.amount - BigInt(1));
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt)
      .mockResolvedValueOnce(successReceipt)
      .mockResolvedValueOnce(successReceipt);

    const { emitter, promise } = repayAssets(mockWalletClient, validParameters);

    const onPreApprove = vi.fn();
    const onUserSignedApproval = vi.fn();
    const onApproveTransactionSucceeded = vi.fn();
    const onPreRepayAssets = vi.fn();
    const onUserSignedRepayAssets = vi.fn();
    const onRepayAssetsTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("user-signed-approval", onUserSignedApproval);
    emitter.on("approve-transaction-succeeded", onApproveTransactionSucceeded);
    emitter.on("pre-repay-assets", onPreRepayAssets);
    emitter.on("user-signed-repay-assets", onUserSignedRepayAssets);
    emitter.on(
      "repay-assets-transaction-succeeded",
      onRepayAssetsTransactionSucceeded,
    );
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onPreApprove).toHaveBeenCalledOnce();
    expect(onUserSignedApproval).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onApproveTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(
      successReceipt,
    );
    expect(onPreRepayAssets).toHaveBeenCalledOnce();
    expect(onUserSignedRepayAssets).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onRepayAssetsTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(
      successReceipt,
    );
    expect(approve).toHaveBeenCalledOnce();
    expect(writeContract).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should approve with approveAmount when provided and allowance is insufficient", async function () {
    const successReceipt = {
      status: "success",
    } as TransactionReceipt;

    const approveAmount = validParameters.amount * BigInt(10);

    vi.mocked(readContract).mockResolvedValue(mockMarketParams);
    vi.mocked(allowance).mockResolvedValue(validParameters.amount - BigInt(1));
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt)
      .mockResolvedValueOnce(successReceipt)
      .mockResolvedValueOnce(successReceipt);

    const { emitter, promise } = repayAssets(mockWalletClient, {
      ...validParameters,
      approveAmount,
    });

    const onSettled = vi.fn();
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(approve).toHaveBeenCalledWith(
      mockWalletClient,
      expect.objectContaining({
        amount: approveAmount,
      }),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'user-signing-approval-error' when approval signing fails", async function () {
    vi.mocked(readContract).mockResolvedValue(mockMarketParams);
    vi.mocked(allowance).mockResolvedValue(validParameters.amount - BigInt(1));
    vi.mocked(approve).mockRejectedValue(new Error("Approval signing error"));

    const { emitter, promise } = repayAssets(mockWalletClient, validParameters);

    const onPreApprove = vi.fn();
    const onUserSigningApprovalError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("user-signing-approval-error", onUserSigningApprovalError);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onPreApprove).toHaveBeenCalledOnce();
    expect(onUserSigningApprovalError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'approve-transaction-reverted' when approval transaction reverts", async function () {
    const approvalReceipt = {
      status: "reverted",
    } as TransactionReceipt;

    vi.mocked(readContract).mockResolvedValue(mockMarketParams);
    vi.mocked(allowance).mockResolvedValue(validParameters.amount - BigInt(1));
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(approvalReceipt);

    const { emitter, promise } = repayAssets(mockWalletClient, validParameters);

    const onPreApprove = vi.fn();
    const onUserSignedApproval = vi.fn();
    const onApproveTransactionReverted = vi.fn();
    const onPreRepayAssets = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("user-signed-approval", onUserSignedApproval);
    emitter.on("approve-transaction-reverted", onApproveTransactionReverted);
    emitter.on("pre-repay-assets", onPreRepayAssets);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onPreApprove).toHaveBeenCalledOnce();
    expect(onUserSignedApproval).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onApproveTransactionReverted).toHaveBeenCalledExactlyOnceWith(
      approvalReceipt,
    );
    expect(onPreRepayAssets).not.toHaveBeenCalled();
    expect(approve).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed' when approval receipt fails", async function () {
    vi.mocked(readContract).mockResolvedValue(mockMarketParams);
    vi.mocked(allowance).mockResolvedValue(validParameters.amount - BigInt(1));
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(
      new Error("Receipt error"),
    );

    const { emitter, promise } = repayAssets(mockWalletClient, validParameters);

    const onPreApprove = vi.fn();
    const onUserSignedApproval = vi.fn();
    const onRepayAssetsFailed = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("user-signed-approval", onUserSignedApproval);
    emitter.on("repay-assets-failed", onRepayAssetsFailed);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onPreApprove).toHaveBeenCalledOnce();
    expect(onUserSignedApproval).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onRepayAssetsFailed).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'user-signing-repay-assets-error' when signing fails", async function () {
    vi.mocked(readContract).mockResolvedValue(mockMarketParams);
    vi.mocked(allowance).mockResolvedValue(validParameters.amount);
    vi.mocked(writeContract).mockRejectedValue(new Error("Signing error"));

    const { emitter, promise } = repayAssets(mockWalletClient, validParameters);

    const onPreRepayAssets = vi.fn();
    const onUserSigningRepayAssetsError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-repay-assets", onPreRepayAssets);
    emitter.on(
      "user-signing-repay-assets-error",
      onUserSigningRepayAssetsError,
    );
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onPreRepayAssets).toHaveBeenCalledOnce();
    expect(onUserSigningRepayAssetsError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-failed' when repay receipt fails", async function () {
    vi.mocked(readContract).mockResolvedValue(mockMarketParams);
    vi.mocked(allowance).mockResolvedValue(validParameters.amount);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(
      new Error("Receipt error"),
    );

    const { emitter, promise } = repayAssets(mockWalletClient, validParameters);

    const onPreRepayAssets = vi.fn();
    const onUserSignedRepayAssets = vi.fn();
    const onRepayAssetsFailed = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-repay-assets", onPreRepayAssets);
    emitter.on("user-signed-repay-assets", onUserSignedRepayAssets);
    emitter.on("repay-assets-failed", onRepayAssetsFailed);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onPreRepayAssets).toHaveBeenCalledOnce();
    expect(onUserSignedRepayAssets).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onRepayAssetsFailed).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'repay-assets-transaction-reverted' when transaction reverts", async function () {
    const receipt = {
      status: "reverted",
    } as TransactionReceipt;

    vi.mocked(readContract).mockResolvedValue(mockMarketParams);
    vi.mocked(allowance).mockResolvedValue(validParameters.amount);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = repayAssets(mockWalletClient, validParameters);

    const onPreRepayAssets = vi.fn();
    const onUserSignedRepayAssets = vi.fn();
    const onRepayAssetsTransactionReverted = vi.fn();
    const onRepayAssetsTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-repay-assets", onPreRepayAssets);
    emitter.on("user-signed-repay-assets", onUserSignedRepayAssets);
    emitter.on(
      "repay-assets-transaction-reverted",
      onRepayAssetsTransactionReverted,
    );
    emitter.on(
      "repay-assets-transaction-succeeded",
      onRepayAssetsTransactionSucceeded,
    );
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onPreRepayAssets).toHaveBeenCalledOnce();
    expect(onUserSignedRepayAssets).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onRepayAssetsTransactionReverted).toHaveBeenCalledExactlyOnceWith(
      receipt,
    );
    expect(onRepayAssetsTransactionSucceeded).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'unexpected-error' when readContract fails", async function () {
    vi.mocked(readContract).mockRejectedValue(
      new Error("Failed to read contract"),
    );

    const { emitter, promise } = repayAssets(mockWalletClient, validParameters);

    const onUnexpectedError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("unexpected-error", onUnexpectedError);
    emitter.on("repay-assets-settled", onSettled);

    await promise;

    expect(onUnexpectedError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });
});
