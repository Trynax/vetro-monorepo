import { type Address, type Client, zeroAddress } from "viem";
import { readContract } from "viem/actions";
import { describe, expect, it, vi } from "vitest";

import { getEpoch } from "../../src/actions/public/getEpoch.ts";

vi.mock("viem/actions", () => ({
  readContract: vi.fn(),
}));

const validParameters = {
  address: "0x1234567890123456789012345678901234567890" as Address,
  epochId: 1n,
};

// @ts-expect-error - We only create an empty client for testing purposes
const client: Client = {};

describe("getEpoch", function () {
  it("should throw an error if client is not defined", async function () {
    await expect(
      // @ts-expect-error - Testing invalid input
      getEpoch(undefined, validParameters),
    ).rejects.toThrow("Client is not defined");
  });

  it("should throw an error if parameters are not provided", async function () {
    // @ts-expect-error - Testing invalid input
    await expect(getEpoch(client, undefined)).rejects.toThrow(
      "Parameters are required",
    );
  });

  it("should throw an error if the address is not valid", async function () {
    const parameters = {
      ...validParameters,
      address: "invalid_address",
    };
    // @ts-expect-error - Testing invalid input
    await expect(getEpoch(client, parameters)).rejects.toThrow(
      "Vault address is invalid",
    );
  });

  it("should throw an error if the address is not provided", async function () {
    const parameters = {
      epochId: validParameters.epochId,
    };
    // @ts-expect-error - Testing invalid input
    await expect(getEpoch(client, parameters)).rejects.toThrow(
      "Vault address is invalid",
    );
  });

  it("should throw an error if the address is zero address", async function () {
    const parameters = {
      ...validParameters,
      address: zeroAddress,
    };

    await expect(getEpoch(client, parameters)).rejects.toThrow(
      "Vault address is invalid",
    );
  });

  it("should throw an error if the epoch ID is not a bigint", async function () {
    const parameters = {
      ...validParameters,
      epochId: 1,
    };
    // @ts-expect-error - Testing invalid input
    await expect(getEpoch(client, parameters)).rejects.toThrow(
      "Epoch ID must be a bigint",
    );
  });

  it("should throw an error if the epoch ID is not provided", async function () {
    const parameters = {
      address: validParameters.address,
    };
    // @ts-expect-error - Testing invalid input
    await expect(getEpoch(client, parameters)).rejects.toThrow(
      "Epoch ID must be a bigint",
    );
  });

  it("should return the epoch with its windows as absolute timestamps", async function () {
    vi.mocked(readContract).mockResolvedValueOnce({
      accrualInterval: 1_000n,
      deposits: 50n,
      end: 10_000n,
      entryWindow: 2_000n,
      exitWindow: 500n,
      maxDeposits: 100n,
      rate: 100_000_000_000_000_000n,
      start: 5_000n,
    });

    const epoch = await getEpoch(client, validParameters);

    expect(readContract).toHaveBeenCalledWith(client, {
      abi: expect.anything(),
      address: validParameters.address,
      args: [validParameters.epochId],
      functionName: "getEpoch",
    });
    expect(epoch).toEqual({
      accrualInterval: { end: 10_000n, start: 9_000n },
      deposits: 50n,
      end: 10_000n,
      entryWindow: { end: 7_000n, start: 5_000n },
      exitWindow: { end: 10_000n, start: 9_500n },
      maxDeposits: 100n,
      rate: 100_000_000_000_000_000n,
      start: 5_000n,
    });
  });
});
