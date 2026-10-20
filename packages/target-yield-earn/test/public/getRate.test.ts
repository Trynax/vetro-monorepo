import { type Address, type Client, zeroAddress } from "viem";
import { readContract } from "viem/actions";
import { describe, expect, it, vi } from "vitest";

import { getRate } from "../../src/actions/public/getRate.ts";

vi.mock("viem/actions", () => ({
  readContract: vi.fn(),
}));

const validParameters = {
  address: "0x1234567890123456789012345678901234567890" as Address,
  epochId: 1n,
};

// @ts-expect-error - We only create an empty client for testing purposes
const client: Client = {};

describe("getRate", function () {
  it("should throw an error if client is not defined", async function () {
    await expect(
      // @ts-expect-error - Testing invalid input
      getRate(undefined, validParameters),
    ).rejects.toThrow("Client is not defined");
  });

  it("should throw an error if parameters are not provided", async function () {
    // @ts-expect-error - Testing invalid input
    await expect(getRate(client, undefined)).rejects.toThrow(
      "Parameters are required",
    );
  });

  it("should throw an error if the address is not valid", async function () {
    const parameters = {
      ...validParameters,
      address: "invalid_address",
    };
    // @ts-expect-error - Testing invalid input
    await expect(getRate(client, parameters)).rejects.toThrow(
      "Vault address is invalid",
    );
  });

  it("should throw an error if the address is not provided", async function () {
    const parameters = {
      epochId: validParameters.epochId,
    };
    // @ts-expect-error - Testing invalid input
    await expect(getRate(client, parameters)).rejects.toThrow(
      "Vault address is invalid",
    );
  });

  it("should throw an error if the address is zero address", async function () {
    const parameters = {
      ...validParameters,
      address: zeroAddress,
    };

    await expect(getRate(client, parameters)).rejects.toThrow(
      "Vault address is invalid",
    );
  });

  it("should throw an error if the epoch ID is not a bigint", async function () {
    const parameters = {
      ...validParameters,
      epochId: 1,
    };
    // @ts-expect-error - Testing invalid input
    await expect(getRate(client, parameters)).rejects.toThrow(
      "Epoch ID must be a bigint",
    );
  });

  it("should throw an error if the epoch ID is not provided", async function () {
    const parameters = {
      address: validParameters.address,
    };
    // @ts-expect-error - Testing invalid input
    await expect(getRate(client, parameters)).rejects.toThrow(
      "Epoch ID must be a bigint",
    );
  });

  it("should call readContract if all parameters are valid", async function () {
    await getRate(client, validParameters);

    expect(readContract).toHaveBeenCalledWith(client, {
      abi: expect.anything(),
      address: validParameters.address,
      args: [validParameters.epochId],
      functionName: "rate",
    });
  });
});
