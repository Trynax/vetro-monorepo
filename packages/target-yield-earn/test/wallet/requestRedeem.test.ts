import {
  type Address,
  type TransactionReceipt,
  type WalletClient,
  zeroAddress,
  zeroHash,
} from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { sepolia } from "viem/chains";
import { requestRedeem as erc7540RequestRedeem } from "viem-erc7540/actions";
import { describe, expect, it, vi } from "vitest";

import { requestRedeem } from "../../src/actions/wallet/requestRedeem.ts";

vi.mock("viem/actions", () => ({
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock("viem-erc7540/actions", () => ({
  requestRedeem: vi.fn(),
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
  owner: "0x1111111111111111111111111111111111111111" as Address,
  shares: BigInt(1000),
};

describe("requestRedeem", function () {
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
    "should emit 'request-redeem-failed-validation' if $name",
    async function ({ client, reason }) {
      const { emitter, promise } = requestRedeem(
        client as unknown as WalletClient,
        validParameters,
      );

      const onFailedValidation = vi.fn();
      const onSettled = vi.fn();

      emitter.on("request-redeem-failed-validation", onFailedValidation);
      emitter.on("request-redeem-settled", onSettled);

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
      name: "shares is not a bigint",
      parameters: { shares: 1000 },
      reason: "Shares must be a bigint",
    },
    {
      name: "shares is zero",
      parameters: { shares: BigInt(0) },
      reason: "Shares must be greater than 0",
    },
  ])(
    "should emit 'request-redeem-failed-validation' if $name",
    async function ({ parameters, reason }) {
      const { emitter, promise } = requestRedeem(mockWalletClient, {
        ...validParameters,
        ...(parameters as Partial<typeof validParameters>),
      });

      const onFailedValidation = vi.fn();
      const onSettled = vi.fn();

      emitter.on("request-redeem-failed-validation", onFailedValidation);
      emitter.on("request-redeem-settled", onSettled);

      await promise;

      expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(reason);
      expect(erc7540RequestRedeem).not.toHaveBeenCalled();
      expect(onSettled).toHaveBeenCalledOnce();
    },
  );

  it("should emit success events when request redeem succeeds", async function () {
    const receipt = {
      status: "success",
    } as TransactionReceipt;

    vi.mocked(erc7540RequestRedeem).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = requestRedeem(
      mockWalletClient,
      validParameters,
    );

    const onPreRequestRedeem = vi.fn();
    const onUserSignedRequestRedeem = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-request-redeem", onPreRequestRedeem);
    emitter.on("user-signed-request-redeem", onUserSignedRequestRedeem);
    emitter.on("request-redeem-transaction-succeeded", onTransactionSucceeded);
    emitter.on("request-redeem-settled", onSettled);

    await promise;

    expect(onPreRequestRedeem).toHaveBeenCalledOnce();
    expect(onUserSignedRequestRedeem).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(erc7540RequestRedeem).toHaveBeenCalledExactlyOnceWith(
      mockWalletClient,
      validParameters,
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'user-signing-request-redeem-error' when signing fails", async function () {
    vi.mocked(erc7540RequestRedeem).mockRejectedValue(
      new Error("Signing error"),
    );

    const { emitter, promise } = requestRedeem(
      mockWalletClient,
      validParameters,
    );

    const onSigningError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("user-signing-request-redeem-error", onSigningError);
    emitter.on("request-redeem-settled", onSettled);

    await promise;

    expect(onSigningError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-redeem-failed' when waiting for the receipt fails", async function () {
    vi.mocked(erc7540RequestRedeem).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(
      new Error("Receipt error"),
    );

    const { emitter, promise } = requestRedeem(
      mockWalletClient,
      validParameters,
    );

    const onFailed = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-redeem-failed", onFailed);
    emitter.on("request-redeem-settled", onSettled);

    await promise;

    expect(onFailed).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'request-redeem-transaction-reverted' when transaction reverts", async function () {
    const receipt = {
      status: "reverted",
    } as TransactionReceipt;

    vi.mocked(erc7540RequestRedeem).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = requestRedeem(
      mockWalletClient,
      validParameters,
    );

    const onTransactionReverted = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("request-redeem-transaction-reverted", onTransactionReverted);
    emitter.on("request-redeem-transaction-succeeded", onTransactionSucceeded);
    emitter.on("request-redeem-settled", onSettled);

    await promise;

    expect(onTransactionReverted).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(onTransactionSucceeded).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'unexpected-error' and settle when params is not defined", async function () {
    const { emitter, promise } = requestRedeem(
      mockWalletClient,
      // @ts-expect-error testing a missing params object
      undefined,
    );

    const onUnexpectedError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("unexpected-error", onUnexpectedError);
    emitter.on("request-redeem-settled", onSettled);

    await promise;

    expect(onUnexpectedError).toHaveBeenCalledExactlyOnceWith(
      expect.any(TypeError),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });
});
