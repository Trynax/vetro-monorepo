import {
  type Address,
  type TransactionReceipt,
  type WalletClient,
  zeroAddress,
  zeroHash,
} from "viem";
import { waitForTransactionReceipt, writeContract } from "viem/actions";
import { sepolia } from "viem/chains";
import { describe, expect, it, vi } from "vitest";

import { cancelRedeemRequest } from "../../src/actions/wallet/cancelRedeemRequest.ts";

vi.mock("viem/actions", () => ({
  waitForTransactionReceipt: vi.fn(),
  writeContract: vi.fn(),
}));

const mockWalletClient = {
  account: {
    address: "0x1111111111111111111111111111111111111111" as Address,
  },
  chain: sepolia,
} as unknown as WalletClient;

const validParameters = {
  address: "0x1234567890123456789012345678901234567890" as Address,
  controller: "0x1111111111111111111111111111111111111111" as Address,
};

describe("cancelRedeemRequest", function () {
  it("should emit 'cancel-redeem-request-failed-validation' if client is not defined", async function () {
    const { emitter, promise } = cancelRedeemRequest(
      // @ts-expect-error - Testing invalid input
      undefined,
      validParameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("cancel-redeem-request-failed-validation", onFailedValidation);
    emitter.on("cancel-redeem-request-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Client is not defined",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'cancel-redeem-request-failed-validation' if client.account is not defined", async function () {
    const clientWithoutAccount = {
      chain: sepolia,
    } as unknown as WalletClient;

    const { emitter, promise } = cancelRedeemRequest(
      clientWithoutAccount,
      validParameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("cancel-redeem-request-failed-validation", onFailedValidation);
    emitter.on("cancel-redeem-request-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Client must have an account",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'cancel-redeem-request-failed-validation' when client chain is not defined", async function () {
    const clientWithoutChain = {
      account: mockWalletClient.account,
    } as WalletClient;

    const { emitter, promise } = cancelRedeemRequest(
      clientWithoutChain,
      validParameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("cancel-redeem-request-failed-validation", onFailedValidation);
    emitter.on("cancel-redeem-request-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Chain is not defined on wallet client",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'cancel-redeem-request-failed-validation' if vault address is invalid", async function () {
    const parameters = {
      ...validParameters,
      address: zeroAddress,
    };

    const { emitter, promise } = cancelRedeemRequest(
      mockWalletClient,
      parameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("cancel-redeem-request-failed-validation", onFailedValidation);
    emitter.on("cancel-redeem-request-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid vault address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'cancel-redeem-request-failed-validation' if controller address is invalid", async function () {
    const parameters = {
      ...validParameters,
      controller: zeroAddress,
    };

    const { emitter, promise } = cancelRedeemRequest(
      mockWalletClient,
      parameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("cancel-redeem-request-failed-validation", onFailedValidation);
    emitter.on("cancel-redeem-request-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid controller address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit success events when cancel redeem request succeeds", async function () {
    const receipt = {
      status: "success",
    } as TransactionReceipt;

    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = cancelRedeemRequest(
      mockWalletClient,
      validParameters,
    );

    const onPreCancelRedeemRequest = vi.fn();
    const onUserSignedCancelRedeemRequest = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-cancel-redeem-request", onPreCancelRedeemRequest);
    emitter.on(
      "user-signed-cancel-redeem-request",
      onUserSignedCancelRedeemRequest,
    );
    emitter.on(
      "cancel-redeem-request-transaction-succeeded",
      onTransactionSucceeded,
    );
    emitter.on("cancel-redeem-request-settled", onSettled);

    await promise;

    expect(onPreCancelRedeemRequest).toHaveBeenCalledOnce();
    expect(onUserSignedCancelRedeemRequest).toHaveBeenCalledExactlyOnceWith(
      zeroHash,
    );
    expect(onTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(writeContract).toHaveBeenCalledExactlyOnceWith(mockWalletClient, {
      abi: expect.anything(),
      account: mockWalletClient.account,
      address: validParameters.address,
      args: [validParameters.controller],
      chain: mockWalletClient.chain,
      functionName: "cancelRedeemRequest",
    });
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'user-signing-cancel-redeem-request-error' when signing fails", async function () {
    vi.mocked(writeContract).mockRejectedValue(new Error("Signing error"));

    const { emitter, promise } = cancelRedeemRequest(
      mockWalletClient,
      validParameters,
    );

    const onPreCancelRedeemRequest = vi.fn();
    const onSigningError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-cancel-redeem-request", onPreCancelRedeemRequest);
    emitter.on("user-signing-cancel-redeem-request-error", onSigningError);
    emitter.on("cancel-redeem-request-settled", onSettled);

    await promise;

    expect(onPreCancelRedeemRequest).toHaveBeenCalledOnce();
    expect(onSigningError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'cancel-redeem-request-failed' when waiting for the receipt fails", async function () {
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(
      new Error("Receipt error"),
    );

    const { emitter, promise } = cancelRedeemRequest(
      mockWalletClient,
      validParameters,
    );

    const onFailed = vi.fn();
    const onSettled = vi.fn();

    emitter.on("cancel-redeem-request-failed", onFailed);
    emitter.on("cancel-redeem-request-settled", onSettled);

    await promise;

    expect(onFailed).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'cancel-redeem-request-transaction-reverted' when transaction reverts", async function () {
    const receipt = {
      status: "reverted",
    } as TransactionReceipt;

    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = cancelRedeemRequest(
      mockWalletClient,
      validParameters,
    );

    const onTransactionReverted = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on(
      "cancel-redeem-request-transaction-reverted",
      onTransactionReverted,
    );
    emitter.on(
      "cancel-redeem-request-transaction-succeeded",
      onTransactionSucceeded,
    );
    emitter.on("cancel-redeem-request-settled", onSettled);

    await promise;

    expect(onTransactionReverted).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(onTransactionSucceeded).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'unexpected-error' and settle when params is not defined", async function () {
    const { emitter, promise } = cancelRedeemRequest(
      mockWalletClient,
      // @ts-expect-error testing a missing params object
      undefined,
    );

    const onUnexpectedError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("unexpected-error", onUnexpectedError);
    emitter.on("cancel-redeem-request-settled", onSettled);

    await promise;

    expect(onUnexpectedError).toHaveBeenCalledExactlyOnceWith(
      expect.any(TypeError),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });
});
