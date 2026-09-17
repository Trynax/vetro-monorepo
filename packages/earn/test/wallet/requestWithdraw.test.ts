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

import { requestWithdraw } from "../../src/actions/wallet/requestWithdraw.ts";
import { stakingVaultAddresses } from "../../src/stakingVaultAddresses.ts";

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
  assets: BigInt(1000),
  owner: "0x2222222222222222222222222222222222222222" as Address,
  vaultAddress: stakingVaultAddresses[0],
};

describe("requestWithdraw", function () {
  it("should emit 'request-withdraw-failed-validation' if client is not defined", async function () {
    const { emitter, promise } = requestWithdraw(
      // @ts-expect-error - Testing invalid input
      undefined,
      validParameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-withdraw-failed-validation", onFailedValidation);
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Client is not defined",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-withdraw-failed-validation' if client.account is not defined", async function () {
    const clientWithoutAccount = {
      chain: sepolia,
    } as unknown as WalletClient;

    const { emitter, promise } = requestWithdraw(
      clientWithoutAccount,
      validParameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-withdraw-failed-validation", onFailedValidation);
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Client must have an account",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-withdraw-failed-validation' when client chain is not defined", async function () {
    const clientWithoutChain = {
      account: mockWalletClient.account,
    } as WalletClient;

    const { emitter, promise } = requestWithdraw(
      clientWithoutChain,
      validParameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-withdraw-failed-validation", onFailedValidation);
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Chain is not defined on wallet client",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-withdraw-failed-validation' if vault address is invalid", async function () {
    const parameters = {
      ...validParameters,
      vaultAddress: zeroAddress,
    };

    const { emitter, promise } = requestWithdraw(mockWalletClient, parameters);

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-withdraw-failed-validation", onFailedValidation);
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid StakingVault address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-withdraw-failed-validation' if owner address is not valid", async function () {
    const parameters = {
      ...validParameters,
      owner: "invalid_owner",
    };

    const { emitter, promise } = requestWithdraw(
      mockWalletClient,
      // @ts-expect-error - Testing invalid input
      parameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-withdraw-failed-validation", onFailedValidation);
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Invalid owner address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-withdraw-failed-validation' if owner address is zero address", async function () {
    const parameters = {
      ...validParameters,
      owner: zeroAddress,
    };

    const { emitter, promise } = requestWithdraw(mockWalletClient, parameters);

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-withdraw-failed-validation", onFailedValidation);
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Owner address cannot be zero address",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-withdraw-failed-validation' if assets is not a bigint", async function () {
    const parameters = { ...validParameters, assets: 1000 };

    const { emitter, promise } = requestWithdraw(
      mockWalletClient,
      // @ts-expect-error - Testing invalid input
      parameters,
    );

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-withdraw-failed-validation", onFailedValidation);
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Assets must be a bigint",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-withdraw-failed-validation' if assets is zero", async function () {
    const parameters = { ...validParameters, assets: BigInt(0) };

    const { emitter, promise } = requestWithdraw(mockWalletClient, parameters);

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-withdraw-failed-validation", onFailedValidation);
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Assets must be greater than 0",
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit success events when request withdraw succeeds", async function () {
    const receipt = {
      status: "success",
    } as TransactionReceipt;

    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = requestWithdraw(
      mockWalletClient,
      validParameters,
    );

    const onPreRequestWithdraw = vi.fn();
    const onUserSignedRequestWithdraw = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-request-withdraw", onPreRequestWithdraw);
    emitter.on("user-signed-request-withdraw", onUserSignedRequestWithdraw);
    emitter.on(
      "request-withdraw-transaction-succeeded",
      onTransactionSucceeded,
    );
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onPreRequestWithdraw).toHaveBeenCalledOnce();
    expect(onUserSignedRequestWithdraw).toHaveBeenCalledExactlyOnceWith(
      zeroHash,
    );
    expect(onTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(writeContract).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'user-signing-request-withdraw-error' when signing fails", async function () {
    vi.mocked(writeContract).mockRejectedValue(new Error("Signing error"));

    const { emitter, promise } = requestWithdraw(
      mockWalletClient,
      validParameters,
    );

    const onPreRequestWithdraw = vi.fn();
    const onSigningError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-request-withdraw", onPreRequestWithdraw);
    emitter.on("user-signing-request-withdraw-error", onSigningError);
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onPreRequestWithdraw).toHaveBeenCalledOnce();
    expect(onSigningError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit an unknown outcome when receipt fails", async function () {
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(
      new Error("Receipt error"),
    );

    const { emitter, promise } = requestWithdraw(
      mockWalletClient,
      validParameters,
    );

    const onTransactionUnknown = vi.fn();
    const onRequestWithdrawFailed = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-withdraw-transaction-unknown", onTransactionUnknown);
    emitter.on("request-withdraw-failed", onRequestWithdrawFailed);
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onTransactionUnknown).toHaveBeenCalledExactlyOnceWith(
      zeroHash,
      expect.any(Error),
    );
    expect(onRequestWithdrawFailed).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-withdraw-transaction-reverted' when transaction reverts", async function () {
    const receipt = {
      status: "reverted",
    } as TransactionReceipt;

    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = requestWithdraw(
      mockWalletClient,
      validParameters,
    );

    const onTransactionReverted = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-withdraw-transaction-reverted", onTransactionReverted);
    emitter.on(
      "request-withdraw-transaction-succeeded",
      onTransactionSucceeded,
    );
    emitter.on("request-withdraw-settled", onSettled);

    await promise;

    expect(onTransactionReverted).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(onTransactionSucceeded).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });
});
