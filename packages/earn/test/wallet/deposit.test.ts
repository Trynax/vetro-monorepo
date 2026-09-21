import {
  type Address,
  type TransactionReceipt,
  type WalletClient,
  zeroAddress,
  zeroHash,
} from "viem";
import { waitForTransactionReceipt, writeContract } from "viem/actions";
import { sepolia } from "viem/chains";
import { allowance, approve } from "viem-erc20/actions";
import { describe, expect, it, vi } from "vitest";

import { deposit } from "../../src/actions/wallet/deposit.ts";
import { stakingVaultAddresses } from "../../src/stakingVaultAddresses.ts";

vi.mock("viem/actions", () => ({
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

const validParameters = {
  assets: BigInt(1000),
  receiver: "0x2222222222222222222222222222222222222222" as Address,
  token: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
  vaultAddress: stakingVaultAddresses[0],
};

describe("deposit", function () {
  it("should emit 'deposit-failed-validation' if client is not defined", async function () {
    const { emitter, promise } = deposit(
      // @ts-expect-error - Testing invalid input
      undefined,
      validParameters,
    );

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Client is not defined",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' if client.account is not defined", async function () {
    const clientWithoutAccount = {
      chain: sepolia,
    } as unknown as WalletClient;

    const { emitter, promise } = deposit(clientWithoutAccount, validParameters);

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Client must have an account",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' when client chain is not defined", async function () {
    const clientWithoutChain = {
      account: mockWalletClient.account,
    } as WalletClient;

    const { emitter, promise } = deposit(clientWithoutChain, validParameters);

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Chain is not defined on wallet client",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' if vault address is invalid", async function () {
    const parameters = {
      ...validParameters,
      vaultAddress: zeroAddress,
    };

    const { emitter, promise } = deposit(mockWalletClient, parameters);

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid StakingVault address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' if token address is not valid", async function () {
    const parameters = {
      ...validParameters,
      token: "invalid_token",
    };

    const { emitter, promise } = deposit(
      mockWalletClient,
      // @ts-expect-error - Testing invalid input
      parameters,
    );

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid token address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' if token address is zero address", async function () {
    const parameters = {
      ...validParameters,
      token: zeroAddress,
    };

    const { emitter, promise } = deposit(mockWalletClient, parameters);

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Token address cannot be zero address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' if receiver address is not valid", async function () {
    const parameters = {
      ...validParameters,
      receiver: "invalid_receiver",
    };

    const { emitter, promise } = deposit(
      mockWalletClient,
      // @ts-expect-error - Testing invalid input
      parameters,
    );

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid receiver address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' if receiver address is zero address", async function () {
    const parameters = {
      ...validParameters,
      receiver: zeroAddress,
    };

    const { emitter, promise } = deposit(mockWalletClient, parameters);

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Receiver address cannot be zero address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' if assets is not a bigint", async function () {
    const parameters = { ...validParameters, assets: 1000 };

    const { emitter, promise } = deposit(
      mockWalletClient,
      // @ts-expect-error - Testing invalid input
      parameters,
    );

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Assets must be a bigint",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' if assets is zero", async function () {
    const parameters = { ...validParameters, assets: BigInt(0) };

    const { emitter, promise } = deposit(mockWalletClient, parameters);

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Assets must be greater than 0",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' if assets is negative", async function () {
    const parameters = { ...validParameters, assets: BigInt(-1) };

    const { emitter, promise } = deposit(mockWalletClient, parameters);

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Assets must be greater than 0",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should skip approval if allowance is sufficient and proceed to deposit", async function () {
    const receipt = {
      status: "success",
    } as TransactionReceipt;

    vi.mocked(allowance).mockResolvedValue(validParameters.assets);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = deposit(mockWalletClient, validParameters);

    const onPreApprove = vi.fn();
    const onPreDeposit = vi.fn();
    const onUserSignedDeposit = vi.fn();
    const onDepositTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("pre-deposit", onPreDeposit);
    emitter.on("user-signed-deposit", onUserSignedDeposit);
    emitter.on("deposit-transaction-succeeded", onDepositTransactionSucceeded);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onPreApprove).not.toHaveBeenCalled();
    expect(onPreDeposit).toHaveBeenCalledOnce();
    expect(onUserSignedDeposit).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onDepositTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(
      receipt,
    );
    expect(approve).not.toHaveBeenCalled();
    expect(writeContract).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should approve first if allowance is insufficient, then deposit", async function () {
    const approvalReceipt = {
      status: "success",
    } as TransactionReceipt;
    const depositReceipt = {
      status: "success",
    } as TransactionReceipt;

    vi.mocked(allowance).mockResolvedValue(validParameters.assets - BigInt(1));
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt)
      .mockResolvedValueOnce(approvalReceipt)
      .mockResolvedValueOnce(depositReceipt);

    const { emitter, promise } = deposit(mockWalletClient, validParameters);

    const onPreApprove = vi.fn();
    const onUserSignedApproval = vi.fn();
    const onApproveTransactionSucceeded = vi.fn();
    const onPreDeposit = vi.fn();
    const onUserSignedDeposit = vi.fn();
    const onDepositTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("user-signed-approval", onUserSignedApproval);
    emitter.on("approve-transaction-succeeded", onApproveTransactionSucceeded);
    emitter.on("pre-deposit", onPreDeposit);
    emitter.on("user-signed-deposit", onUserSignedDeposit);
    emitter.on("deposit-transaction-succeeded", onDepositTransactionSucceeded);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onPreApprove).toHaveBeenCalledOnce();
    expect(onUserSignedApproval).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onApproveTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(
      approvalReceipt,
    );
    expect(onPreDeposit).toHaveBeenCalledOnce();
    expect(onUserSignedDeposit).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onDepositTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(
      depositReceipt,
    );
    expect(approve).toHaveBeenCalledOnce();
    expect(writeContract).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'user-signing-approval-error' when approval signing fails", async function () {
    vi.mocked(allowance).mockResolvedValue(validParameters.assets - BigInt(1));
    vi.mocked(approve).mockRejectedValue(new Error("Approval signing error"));

    const { emitter, promise } = deposit(mockWalletClient, validParameters);

    const onPreApprove = vi.fn();
    const onUserSigningApprovalError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("user-signing-approval-error", onUserSigningApprovalError);
    emitter.on("deposit-settled", onSettled);

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

    vi.mocked(allowance).mockResolvedValue(validParameters.assets - BigInt(1));
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(approvalReceipt);

    const { emitter, promise } = deposit(mockWalletClient, validParameters);

    const onPreApprove = vi.fn();
    const onUserSignedApproval = vi.fn();
    const onApproveTransactionReverted = vi.fn();
    const onApproveTransactionSucceeded = vi.fn();
    const onPreDeposit = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("user-signed-approval", onUserSignedApproval);
    emitter.on("approve-transaction-reverted", onApproveTransactionReverted);
    emitter.on("approve-transaction-succeeded", onApproveTransactionSucceeded);
    emitter.on("pre-deposit", onPreDeposit);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onPreApprove).toHaveBeenCalledOnce();
    expect(onUserSignedApproval).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onApproveTransactionReverted).toHaveBeenCalledExactlyOnceWith(
      approvalReceipt,
    );
    expect(onApproveTransactionSucceeded).not.toHaveBeenCalled();
    expect(onPreDeposit).not.toHaveBeenCalled();
    expect(approve).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed' when approval receipt fails", async function () {
    vi.mocked(allowance).mockResolvedValue(validParameters.assets - BigInt(1));
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(
      new Error("Receipt error"),
    );

    const { emitter, promise } = deposit(mockWalletClient, validParameters);

    const onPreApprove = vi.fn();
    const onUserSignedApproval = vi.fn();
    const onDepositFailed = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("user-signed-approval", onUserSignedApproval);
    emitter.on("deposit-failed", onDepositFailed);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onPreApprove).toHaveBeenCalledOnce();
    expect(onUserSignedApproval).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onDepositFailed).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'user-signing-deposit-error' when deposit signing fails", async function () {
    vi.mocked(allowance).mockResolvedValue(validParameters.assets);
    vi.mocked(writeContract).mockRejectedValue(
      new Error("Deposit signing error"),
    );

    const { emitter, promise } = deposit(mockWalletClient, validParameters);

    const onPreDeposit = vi.fn();
    const onUserSigningDepositError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-deposit", onPreDeposit);
    emitter.on("user-signing-deposit-error", onUserSigningDepositError);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onPreDeposit).toHaveBeenCalledOnce();
    expect(onUserSigningDepositError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed' when deposit receipt fails", async function () {
    vi.mocked(allowance).mockResolvedValue(validParameters.assets);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(
      new Error("Receipt error"),
    );

    const { emitter, promise } = deposit(mockWalletClient, validParameters);

    const onPreDeposit = vi.fn();
    const onUserSignedDeposit = vi.fn();
    const onDepositFailed = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-deposit", onPreDeposit);
    emitter.on("user-signed-deposit", onUserSignedDeposit);
    emitter.on("deposit-failed", onDepositFailed);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onPreDeposit).toHaveBeenCalledOnce();
    expect(onUserSignedDeposit).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onDepositFailed).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-transaction-reverted' when deposit transaction reverts", async function () {
    const receipt = {
      status: "reverted",
    } as TransactionReceipt;

    vi.mocked(allowance).mockResolvedValue(validParameters.assets);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = deposit(mockWalletClient, validParameters);

    const onPreDeposit = vi.fn();
    const onUserSignedDeposit = vi.fn();
    const onDepositTransactionReverted = vi.fn();
    const onDepositTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-deposit", onPreDeposit);
    emitter.on("user-signed-deposit", onUserSignedDeposit);
    emitter.on("deposit-transaction-reverted", onDepositTransactionReverted);
    emitter.on("deposit-transaction-succeeded", onDepositTransactionSucceeded);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onPreDeposit).toHaveBeenCalledOnce();
    expect(onUserSignedDeposit).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onDepositTransactionReverted).toHaveBeenCalledExactlyOnceWith(
      receipt,
    );
    expect(onDepositTransactionSucceeded).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'deposit-failed-validation' if approveAmount is less than assets", async function () {
    const parameters = {
      ...validParameters,
      approveAmount: validParameters.assets - BigInt(1),
    };

    const { emitter, promise } = deposit(mockWalletClient, parameters);

    const onDepositFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("deposit-failed-validation", onDepositFailedValidation);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onDepositFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Approve amount must be greater than or equal to assets",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should approve with approveAmount when provided and allowance is insufficient", async function () {
    const approvalReceipt = {
      status: "success",
    } as TransactionReceipt;
    const depositReceipt = {
      status: "success",
    } as TransactionReceipt;

    const approveAmount = validParameters.assets * BigInt(10);

    vi.mocked(allowance).mockResolvedValue(validParameters.assets - BigInt(1));
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt)
      .mockResolvedValueOnce(approvalReceipt)
      .mockResolvedValueOnce(depositReceipt);

    const { emitter, promise } = deposit(mockWalletClient, {
      ...validParameters,
      approveAmount,
    });

    const onSettled = vi.fn();
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(approve).toHaveBeenCalledWith(
      mockWalletClient,
      expect.objectContaining({
        amount: approveAmount,
      }),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'unexpected-error' when allowance fails", async function () {
    vi.mocked(allowance).mockRejectedValue(
      new Error("Failed to get allowance"),
    );

    const { emitter, promise } = deposit(mockWalletClient, validParameters);

    const onUnexpectedError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("unexpected-error", onUnexpectedError);
    emitter.on("deposit-settled", onSettled);

    await promise;

    expect(onUnexpectedError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });
});
