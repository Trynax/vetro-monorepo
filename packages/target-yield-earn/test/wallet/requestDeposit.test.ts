import {
  type Address,
  type TransactionReceipt,
  type WalletClient,
  zeroAddress,
  zeroHash,
} from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { sepolia } from "viem/chains";
import {
  allowance,
  approve,
  asset,
  requestDeposit as erc7540RequestDeposit,
} from "viem-erc7540/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestDeposit } from "../../src/actions/wallet/requestDeposit.ts";

vi.mock("viem/actions", () => ({
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock("viem-erc7540/actions", () => ({
  allowance: vi.fn(),
  approve: vi.fn(),
  asset: vi.fn(),
  requestDeposit: vi.fn(),
}));

const mockWalletClient = {
  account: {
    address: "0x1111111111111111111111111111111111111111" as Address,
  },
  chain: sepolia,
} as unknown as WalletClient;

const token = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;

const validParameters = {
  address: "0x1234567890123456789012345678901234567890" as Address,
  assets: BigInt(1000),
  controller: "0x1111111111111111111111111111111111111111" as Address,
  owner: "0x1111111111111111111111111111111111111111" as Address,
};

const successReceipt = { status: "success" } as TransactionReceipt;

describe("requestDeposit", function () {
  beforeEach(function () {
    vi.mocked(asset).mockResolvedValue(token);
  });

  it.each([
    {
      client: undefined,
      name: "client is not defined",
      reason: "Client is not defined",
    },
    {
      client: { chain: sepolia },
      name: "client.account is not defined",
      reason: "Client must have an account",
    },
    {
      client: { account: mockWalletClient.account },
      name: "client chain is not defined",
      reason: "Chain is not defined on wallet client",
    },
  ])(
    "should emit 'request-deposit-failed-validation' if $name",
    async function ({ client, reason }) {
      const { emitter, promise } = requestDeposit(
        client as unknown as WalletClient,
        validParameters,
      );

      const onFailedValidation = vi.fn();
      const onSettled = vi.fn();

      emitter.on("request-deposit-failed-validation", onFailedValidation);
      emitter.on("request-deposit-settled", onSettled);

      await promise;

      expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(reason);
      expect(onSettled).toHaveBeenCalledOnce();
    },
  );

  it.each([
    {
      name: "vault address is invalid",
      parameters: { address: zeroAddress },
      reason: "Invalid vault address",
    },
    {
      name: "controller address is invalid",
      parameters: { controller: zeroAddress },
      reason: "Invalid controller address",
    },
    {
      name: "owner address is invalid",
      parameters: { owner: zeroAddress },
      reason: "Invalid owner address",
    },
    {
      name: "assets is not a bigint",
      parameters: { assets: 1000 },
      reason: "Assets must be a bigint",
    },
    {
      name: "assets is zero",
      parameters: { assets: BigInt(0) },
      reason: "Assets must be greater than 0",
    },
    {
      name: "approve amount is lower than assets",
      parameters: { approveAmount: BigInt(999) },
      reason: "Approve amount must be greater than or equal to assets",
    },
  ])(
    "should emit 'request-deposit-failed-validation' if $name",
    async function ({ parameters, reason }) {
      const { emitter, promise } = requestDeposit(mockWalletClient, {
        ...validParameters,
        ...(parameters as Partial<typeof validParameters>),
      });

      const onFailedValidation = vi.fn();
      const onSettled = vi.fn();

      emitter.on("request-deposit-failed-validation", onFailedValidation);
      emitter.on("request-deposit-settled", onSettled);

      await promise;

      expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(reason);
      expect(erc7540RequestDeposit).not.toHaveBeenCalled();
      expect(onSettled).toHaveBeenCalledOnce();
    },
  );

  it("should skip the approval if the allowance covers the assets", async function () {
    vi.mocked(allowance).mockResolvedValue(validParameters.assets);
    vi.mocked(erc7540RequestDeposit).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(successReceipt);

    const { emitter, promise } = requestDeposit(
      mockWalletClient,
      validParameters,
    );

    const onPreApprove = vi.fn();
    const onPreRequestDeposit = vi.fn();
    const onUserSignedRequestDeposit = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("pre-request-deposit", onPreRequestDeposit);
    emitter.on("user-signed-request-deposit", onUserSignedRequestDeposit);
    emitter.on("request-deposit-transaction-succeeded", onTransactionSucceeded);
    emitter.on("request-deposit-settled", onSettled);

    await promise;

    expect(asset).toHaveBeenCalledExactlyOnceWith(mockWalletClient, {
      address: validParameters.address,
    });
    expect(allowance).toHaveBeenCalledExactlyOnceWith(mockWalletClient, {
      address: token,
      owner: validParameters.owner,
      spender: validParameters.address,
    });
    expect(onPreApprove).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
    expect(onPreRequestDeposit).toHaveBeenCalledOnce();
    expect(onUserSignedRequestDeposit).toHaveBeenCalledExactlyOnceWith(
      zeroHash,
    );
    expect(onTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(
      successReceipt,
    );
    expect(erc7540RequestDeposit).toHaveBeenCalledExactlyOnceWith(
      mockWalletClient,
      validParameters,
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should approve and then request the deposit if the allowance is not enough", async function () {
    const approveAmount = BigInt(5000);

    vi.mocked(allowance).mockResolvedValue(BigInt(0));
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(erc7540RequestDeposit).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(successReceipt);

    const { emitter, promise } = requestDeposit(mockWalletClient, {
      ...validParameters,
      approveAmount,
    });

    const onPreApprove = vi.fn();
    const onUserSignedApproval = vi.fn();
    const onApproveSucceeded = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-approve", onPreApprove);
    emitter.on("user-signed-approval", onUserSignedApproval);
    emitter.on("approve-transaction-succeeded", onApproveSucceeded);
    emitter.on("request-deposit-transaction-succeeded", onTransactionSucceeded);
    emitter.on("request-deposit-settled", onSettled);

    await promise;

    expect(onPreApprove).toHaveBeenCalledOnce();
    expect(approve).toHaveBeenCalledExactlyOnceWith(mockWalletClient, {
      address: token,
      amount: approveAmount,
      spender: validParameters.address,
    });
    expect(onUserSignedApproval).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onApproveSucceeded).toHaveBeenCalledExactlyOnceWith(successReceipt);
    expect(onTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(
      successReceipt,
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should default the owner to the wallet account", async function () {
    const { owner, ...parametersWithoutOwner } = validParameters;

    vi.mocked(allowance).mockResolvedValue(validParameters.assets);
    vi.mocked(erc7540RequestDeposit).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(successReceipt);

    const { promise } = requestDeposit(
      mockWalletClient,
      parametersWithoutOwner,
    );

    await promise;

    expect(allowance).toHaveBeenCalledExactlyOnceWith(mockWalletClient, {
      address: token,
      owner,
      spender: validParameters.address,
    });
    expect(erc7540RequestDeposit).toHaveBeenCalledExactlyOnceWith(
      mockWalletClient,
      { ...parametersWithoutOwner, owner },
    );
  });

  it("should emit 'request-deposit-failed-validation' if the owner is not the wallet account and the allowance is not enough", async function () {
    vi.mocked(allowance).mockResolvedValue(BigInt(0));

    const { emitter, promise } = requestDeposit(mockWalletClient, {
      ...validParameters,
      owner: "0x2222222222222222222222222222222222222222",
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-deposit-failed-validation", onFailedValidation);
    emitter.on("request-deposit-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Owner allowance is lower than assets",
    );
    expect(approve).not.toHaveBeenCalled();
    expect(erc7540RequestDeposit).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'user-signing-approval-error' when signing the approval fails", async function () {
    vi.mocked(allowance).mockResolvedValue(BigInt(0));
    vi.mocked(approve).mockRejectedValue(new Error("Signing error"));

    const { emitter, promise } = requestDeposit(
      mockWalletClient,
      validParameters,
    );

    const onSigningError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("user-signing-approval-error", onSigningError);
    emitter.on("request-deposit-settled", onSettled);

    await promise;

    expect(onSigningError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(erc7540RequestDeposit).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'approve-transaction-reverted' when the approval reverts", async function () {
    const receipt = { status: "reverted" } as TransactionReceipt;

    vi.mocked(allowance).mockResolvedValue(BigInt(0));
    vi.mocked(approve).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = requestDeposit(
      mockWalletClient,
      validParameters,
    );

    const onApproveReverted = vi.fn();
    const onSettled = vi.fn();

    emitter.on("approve-transaction-reverted", onApproveReverted);
    emitter.on("request-deposit-settled", onSettled);

    await promise;

    expect(onApproveReverted).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(erc7540RequestDeposit).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'user-signing-request-deposit-error' when signing fails", async function () {
    vi.mocked(allowance).mockResolvedValue(validParameters.assets);
    vi.mocked(erc7540RequestDeposit).mockRejectedValue(
      new Error("Signing error"),
    );

    const { emitter, promise } = requestDeposit(
      mockWalletClient,
      validParameters,
    );

    const onSigningError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("user-signing-request-deposit-error", onSigningError);
    emitter.on("request-deposit-settled", onSettled);

    await promise;

    expect(onSigningError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-deposit-failed' when waiting for the receipt fails", async function () {
    vi.mocked(allowance).mockResolvedValue(validParameters.assets);
    vi.mocked(erc7540RequestDeposit).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(
      new Error("Receipt error"),
    );

    const { emitter, promise } = requestDeposit(
      mockWalletClient,
      validParameters,
    );

    const onFailed = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-deposit-failed", onFailed);
    emitter.on("request-deposit-settled", onSettled);

    await promise;

    expect(onFailed).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-deposit-transaction-reverted' when transaction reverts", async function () {
    const receipt = { status: "reverted" } as TransactionReceipt;

    vi.mocked(allowance).mockResolvedValue(validParameters.assets);
    vi.mocked(erc7540RequestDeposit).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = requestDeposit(
      mockWalletClient,
      validParameters,
    );

    const onTransactionReverted = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-deposit-transaction-reverted", onTransactionReverted);
    emitter.on("request-deposit-transaction-succeeded", onTransactionSucceeded);
    emitter.on("request-deposit-settled", onSettled);

    await promise;

    expect(onTransactionReverted).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(onTransactionSucceeded).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'unexpected-error' when reading the vault asset fails", async function () {
    vi.mocked(asset).mockRejectedValue(new Error("RPC error"));

    const { emitter, promise } = requestDeposit(
      mockWalletClient,
      validParameters,
    );

    const onUnexpectedError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("unexpected-error", onUnexpectedError);
    emitter.on("request-deposit-settled", onSettled);

    await promise;

    expect(onUnexpectedError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'unexpected-error' and settle when params is not defined", async function () {
    const { emitter, promise } = requestDeposit(
      mockWalletClient,
      // @ts-expect-error testing a missing params object
      undefined,
    );

    const onUnexpectedError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("unexpected-error", onUnexpectedError);
    emitter.on("request-deposit-settled", onSettled);

    await promise;

    expect(onUnexpectedError).toHaveBeenCalledExactlyOnceWith(
      expect.any(TypeError),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });
});
