import { type Address, type Client, zeroAddress } from "viem";
import { readContract } from "viem/actions";
import { describe, expect, it, vi } from "vitest";

import { getMaxRequestRedeem } from "../../src/actions/public/getMaxRequestRedeem.ts";

vi.mock("viem/actions", () => ({
  readContract: vi.fn(),
}));

const validParameters = {
  address: "0x1234567890123456789012345678901234567890" as Address,
  controller: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
  owner: "0x0987654321098765432109876543210987654321" as Address,
};

// @ts-expect-error - We only create an empty client for testing purposes
const client: Client = {};

describe("getMaxRequestRedeem", function () {
  it("should throw an error if client is not defined", async function () {
    await expect(
      // @ts-expect-error - Testing invalid input
      getMaxRequestRedeem(undefined, validParameters),
    ).rejects.toThrow("Client is not defined");
  });

  it("should throw an error if parameters are not provided", async function () {
    // @ts-expect-error - Testing invalid input
    await expect(getMaxRequestRedeem(client, undefined)).rejects.toThrow(
      "Parameters are required",
    );
  });

  it("should throw an error if the address is not valid", async function () {
    const parameters = {
      ...validParameters,
      address: "invalid_address",
    };
    // @ts-expect-error - Testing invalid input
    await expect(getMaxRequestRedeem(client, parameters)).rejects.toThrow(
      "Vault address is invalid",
    );
  });

  it("should throw an error if the address is not provided", async function () {
    const parameters = {
      controller: validParameters.controller,
      owner: validParameters.owner,
    };
    // @ts-expect-error - Testing invalid input
    await expect(getMaxRequestRedeem(client, parameters)).rejects.toThrow(
      "Vault address is invalid",
    );
  });

  it("should throw an error if the address is zero address", async function () {
    const parameters = {
      ...validParameters,
      address: zeroAddress,
    };

    await expect(getMaxRequestRedeem(client, parameters)).rejects.toThrow(
      "Vault address is invalid",
    );
  });

  it("should throw an error if the controller is not valid", async function () {
    const parameters = {
      ...validParameters,
      controller: "invalid_address",
    };
    // @ts-expect-error - Testing invalid input
    await expect(getMaxRequestRedeem(client, parameters)).rejects.toThrow(
      "Controller address is invalid",
    );
  });

  it("should throw an error if the controller is not provided", async function () {
    const parameters = {
      address: validParameters.address,
      owner: validParameters.owner,
    };
    // @ts-expect-error - Testing invalid input
    await expect(getMaxRequestRedeem(client, parameters)).rejects.toThrow(
      "Controller address is invalid",
    );
  });

  it("should throw an error if the controller is zero address", async function () {
    const parameters = {
      ...validParameters,
      controller: zeroAddress,
    };

    await expect(getMaxRequestRedeem(client, parameters)).rejects.toThrow(
      "Controller address is invalid",
    );
  });

  it("should throw an error if the owner is not valid", async function () {
    const parameters = {
      ...validParameters,
      owner: "invalid_address",
    };
    // @ts-expect-error - Testing invalid input
    await expect(getMaxRequestRedeem(client, parameters)).rejects.toThrow(
      "Owner address is invalid",
    );
  });

  it("should throw an error if the owner is not provided", async function () {
    const parameters = {
      address: validParameters.address,
      controller: validParameters.controller,
    };
    // @ts-expect-error - Testing invalid input
    await expect(getMaxRequestRedeem(client, parameters)).rejects.toThrow(
      "Owner address is invalid",
    );
  });

  it("should throw an error if the owner is zero address", async function () {
    const parameters = {
      ...validParameters,
      owner: zeroAddress,
    };

    await expect(getMaxRequestRedeem(client, parameters)).rejects.toThrow(
      "Owner address is invalid",
    );
  });

  it("should call readContract if all parameters are valid", async function () {
    await getMaxRequestRedeem(client, validParameters);

    expect(readContract).toHaveBeenCalledWith(client, {
      abi: expect.anything(),
      address: validParameters.address,
      args: [validParameters.controller, validParameters.owner],
      functionName: "maxRequestRedeem",
    });
  });
});
