import {
  type Address,
  decodeFunctionData,
  maxUint256,
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
import { maxDeposit } from "viem-erc7540/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { targetYieldEarnVaultAbi } from "../../src/abi/targetYieldEarnVaultAbi.ts";
import { getIsShutdown } from "../../src/actions/public/getIsShutdown.ts";
import {
  claimDeposit,
  encodeClaimDeposit,
} from "../../src/actions/wallet/claimDeposit.ts";

vi.mock("viem/actions", () => ({
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  writeContract: vi.fn(),
}));

vi.mock("viem-erc7540/actions", () => ({
  maxDeposit: vi.fn(),
}));

vi.mock("../../src/actions/public/getIsShutdown.ts", () => ({
  getIsShutdown: vi.fn(),
}));

const mockWalletClient = {
  account: {
    address: "0x1111111111111111111111111111111111111111" as Address,
  },
  chain: sepolia,
} as unknown as WalletClient;

const validParameters = {
  address: "0x1234567890123456789012345678901234567890" as Address,
  assets: BigInt(1000),
  controller: "0x1111111111111111111111111111111111111111" as Address,
  receiver: "0x2222222222222222222222222222222222222222" as Address,
};

const otherController = "0x3333333333333333333333333333333333333333" as Address;

const rpcError = new Error("RPC error");

const successReceipt = { status: "success" } as TransactionReceipt;

describe("claimDeposit", function () {
  beforeEach(function () {
    vi.mocked(getIsShutdown).mockResolvedValue(false);
    vi.mocked(maxDeposit).mockResolvedValue(validParameters.assets);
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
    "should emit 'claim-deposit-failed-validation' if $name",
    async function ({ client, reason }) {
      const { emitter, promise } = claimDeposit(
        client as unknown as WalletClient,
        validParameters,
      );

      const onFailedValidation = vi.fn();
      const onSettled = vi.fn();

      emitter.on("claim-deposit-failed-validation", onFailedValidation);
      emitter.on("claim-deposit-settled", onSettled);

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
      name: "receiver address is invalid",
      parameters: { receiver: zeroAddress },
      reason: "Invalid receiver address",
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
  ])(
    "should emit 'claim-deposit-failed-validation' if $name",
    async function ({ parameters, reason }) {
      const { emitter, promise } = claimDeposit(mockWalletClient, {
        ...validParameters,
        ...(parameters as Partial<typeof validParameters>),
      });

      const onFailedValidation = vi.fn();
      const onSettled = vi.fn();

      emitter.on("claim-deposit-failed-validation", onFailedValidation);
      emitter.on("claim-deposit-settled", onSettled);

      await promise;

      expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(reason);
      expect(writeContract).not.toHaveBeenCalled();
      expect(onSettled).toHaveBeenCalledOnce();
    },
  );

  it.each([
    {
      claimableAssets: validParameters.assets,
      isShutdown: true,
      name: "the vault is shut down",
      reason: "Vault is shut down",
    },
    {
      claimableAssets: BigInt(0),
      isShutdown: false,
      name: "there is no claimable deposit",
      reason: "No claimable deposit",
    },
    {
      claimableAssets: validParameters.assets - BigInt(1),
      isShutdown: false,
      name: "assets exceed the claimable deposit",
      reason: "Assets exceed the claimable deposit",
    },
  ])(
    "should emit 'claim-deposit-failed-validation' if $name",
    async function ({ claimableAssets, isShutdown, reason }) {
      vi.mocked(getIsShutdown).mockResolvedValue(isShutdown);
      vi.mocked(maxDeposit).mockResolvedValue(claimableAssets);

      const { emitter, promise } = claimDeposit(
        mockWalletClient,
        validParameters,
      );

      const onFailedValidation = vi.fn();
      const onSettled = vi.fn();

      emitter.on("claim-deposit-failed-validation", onFailedValidation);
      emitter.on("claim-deposit-settled", onSettled);

      await promise;

      expect(getIsShutdown).toHaveBeenCalledExactlyOnceWith(mockWalletClient, {
        address: validParameters.address,
      });
      expect(maxDeposit).toHaveBeenCalledExactlyOnceWith(mockWalletClient, {
        address: validParameters.address,
        receiver: validParameters.controller,
      });
      expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(reason);
      expect(writeContract).not.toHaveBeenCalled();
      expect(onSettled).toHaveBeenCalledOnce();
    },
  );

  it("should emit 'claim-deposit-failed-validation' if assets is maxUint256 and there is no claimable deposit", async function () {
    vi.mocked(maxDeposit).mockResolvedValue(BigInt(0));

    const { emitter, promise } = claimDeposit(mockWalletClient, {
      ...validParameters,
      assets: maxUint256,
    });

    const onFailedValidation = vi.fn();
    const onSettled = vi.fn();

    emitter.on("claim-deposit-failed-validation", onFailedValidation);
    emitter.on("claim-deposit-settled", onSettled);

    await promise;

    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "No claimable deposit",
    );
    expect(writeContract).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it.each([
    {
      mockRead: () => vi.mocked(getIsShutdown).mockRejectedValueOnce(rpcError),
      name: "getIsShutdown",
    },
    {
      mockRead: () => vi.mocked(readContract).mockRejectedValueOnce(rpcError),
      name: "isOperator",
    },
    {
      mockRead: () => vi.mocked(maxDeposit).mockRejectedValueOnce(rpcError),
      name: "maxDeposit",
    },
  ])(
    "should emit 'unexpected-error' when the $name read fails",
    async function ({ mockRead }) {
      mockRead();

      const { emitter, promise } = claimDeposit(mockWalletClient, {
        ...validParameters,
        controller: otherController,
      });

      const onUnexpectedError = vi.fn();
      const onSettled = vi.fn();

      emitter.on("unexpected-error", onUnexpectedError);
      emitter.on("claim-deposit-settled", onSettled);

      await promise;

      expect(onUnexpectedError).toHaveBeenCalledExactlyOnceWith(rpcError);
      expect(writeContract).not.toHaveBeenCalled();
      expect(onSettled).toHaveBeenCalledOnce();
    },
  );

  it("should emit 'claim-deposit-failed-validation' if the account is not the controller or its operator", async function () {
    vi.mocked(readContract).mockResolvedValue(false);

    const { emitter, promise } = claimDeposit(mockWalletClient, {
      ...validParameters,
      controller: otherController,
    });

    const onFailedValidation = vi.fn();

    emitter.on("claim-deposit-failed-validation", onFailedValidation);

    await promise;

    expect(readContract).toHaveBeenCalledExactlyOnceWith(mockWalletClient, {
      abi: expect.anything(),
      address: validParameters.address,
      args: [otherController, mockWalletClient.account!.address],
      functionName: "isOperator",
    });
    expect(onFailedValidation).toHaveBeenCalledExactlyOnceWith(
      "Account is not the controller or its operator",
    );
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("should claim for a controller when the account is its operator", async function () {
    vi.mocked(readContract).mockResolvedValue(true);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(successReceipt);

    const { promise } = claimDeposit(mockWalletClient, {
      ...validParameters,
      controller: otherController,
    });

    await promise;

    expect(writeContract).toHaveBeenCalledExactlyOnceWith(
      mockWalletClient,
      expect.objectContaining({
        args: [
          validParameters.assets,
          validParameters.receiver,
          otherController,
        ],
      }),
    );
  });

  it("should not read the operator status when the account is the controller", async function () {
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(successReceipt);

    const { promise } = claimDeposit(mockWalletClient, validParameters);

    await promise;

    expect(readContract).not.toHaveBeenCalled();
  });

  it("should emit success events when the claim succeeds", async function () {
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(successReceipt);

    const { emitter, promise } = claimDeposit(
      mockWalletClient,
      validParameters,
    );

    const onPreClaimDeposit = vi.fn();
    const onUserSignedClaimDeposit = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-claim-deposit", onPreClaimDeposit);
    emitter.on("user-signed-claim-deposit", onUserSignedClaimDeposit);
    emitter.on("claim-deposit-transaction-succeeded", onTransactionSucceeded);
    emitter.on("claim-deposit-settled", onSettled);

    await promise;

    expect(onPreClaimDeposit).toHaveBeenCalledOnce();
    expect(onUserSignedClaimDeposit).toHaveBeenCalledExactlyOnceWith(zeroHash);
    expect(onTransactionSucceeded).toHaveBeenCalledExactlyOnceWith(
      successReceipt,
    );
    expect(writeContract).toHaveBeenCalledExactlyOnceWith(mockWalletClient, {
      abi: expect.anything(),
      account: mockWalletClient.account,
      address: validParameters.address,
      args: [
        validParameters.assets,
        validParameters.receiver,
        validParameters.controller,
      ],
      chain: mockWalletClient.chain,
      functionName: "deposit",
    });
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should default the receiver to the controller", async function () {
    const { address, assets } = validParameters;

    vi.mocked(readContract).mockResolvedValue(true);
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(successReceipt);

    const { promise } = claimDeposit(mockWalletClient, {
      address,
      assets,
      controller: otherController,
    });

    await promise;

    expect(writeContract).toHaveBeenCalledExactlyOnceWith(
      mockWalletClient,
      expect.objectContaining({
        args: [assets, otherController, otherController],
      }),
    );
  });

  it("should pass maxUint256 through to claim the whole request", async function () {
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(successReceipt);

    const { promise } = claimDeposit(mockWalletClient, {
      ...validParameters,
      assets: maxUint256,
    });

    await promise;

    expect(writeContract).toHaveBeenCalledExactlyOnceWith(
      mockWalletClient,
      expect.objectContaining({
        args: [
          maxUint256,
          validParameters.receiver,
          validParameters.controller,
        ],
      }),
    );
  });

  it("should emit 'user-signing-claim-deposit-error' when signing fails", async function () {
    vi.mocked(writeContract).mockRejectedValue(new Error("Signing error"));

    const { emitter, promise } = claimDeposit(
      mockWalletClient,
      validParameters,
    );

    const onPreClaimDeposit = vi.fn();
    const onSigningError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("pre-claim-deposit", onPreClaimDeposit);
    emitter.on("user-signing-claim-deposit-error", onSigningError);
    emitter.on("claim-deposit-settled", onSettled);

    await promise;

    expect(onPreClaimDeposit).toHaveBeenCalledOnce();
    expect(onSigningError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'claim-deposit-failed' when waiting for the receipt fails", async function () {
    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockRejectedValue(
      new Error("Receipt error"),
    );

    const { emitter, promise } = claimDeposit(
      mockWalletClient,
      validParameters,
    );

    const onFailed = vi.fn();
    const onSettled = vi.fn();

    emitter.on("claim-deposit-failed", onFailed);
    emitter.on("claim-deposit-settled", onSettled);

    await promise;

    expect(onFailed).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'claim-deposit-transaction-reverted' when the transaction reverts", async function () {
    const receipt = { status: "reverted" } as TransactionReceipt;

    vi.mocked(writeContract).mockResolvedValue(zeroHash);
    vi.mocked(waitForTransactionReceipt).mockResolvedValue(receipt);

    const { emitter, promise } = claimDeposit(
      mockWalletClient,
      validParameters,
    );

    const onTransactionReverted = vi.fn();
    const onTransactionSucceeded = vi.fn();
    const onSettled = vi.fn();

    emitter.on("claim-deposit-transaction-reverted", onTransactionReverted);
    emitter.on("claim-deposit-transaction-succeeded", onTransactionSucceeded);
    emitter.on("claim-deposit-settled", onSettled);

    await promise;

    expect(onTransactionReverted).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(onTransactionSucceeded).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("should emit 'unexpected-error' and settle when params is not defined", async function () {
    const { emitter, promise } = claimDeposit(
      mockWalletClient,
      // @ts-expect-error testing a missing params object
      undefined,
    );

    const onUnexpectedError = vi.fn();
    const onSettled = vi.fn();

    emitter.on("unexpected-error", onUnexpectedError);
    emitter.on("claim-deposit-settled", onSettled);

    await promise;

    expect(onUnexpectedError).toHaveBeenCalledExactlyOnceWith(
      expect.any(TypeError),
    );
    expect(onSettled).toHaveBeenCalledOnce();
  });
});

describe("encodeClaimDeposit", function () {
  it("defaults the receiver to the controller", function () {
    const { args, functionName } = decodeFunctionData({
      abi: targetYieldEarnVaultAbi,
      data: encodeClaimDeposit({
        address: validParameters.address,
        assets: validParameters.assets,
        controller: validParameters.controller,
      }),
    });

    expect(functionName).toBe("deposit");
    expect(args).toEqual([
      validParameters.assets,
      validParameters.controller,
      validParameters.controller,
    ]);
  });
});
