import { type Address, type Client } from "viem";
import { maxMint as erc4626MaxMint } from "viem-erc4626/actions";
import { describe, expect, it, vi } from "vitest";

import { maxMint } from "../../src/actions/public/maxMint.ts";

vi.mock("viem-erc4626/actions", () => ({
  maxMint: vi.fn(),
}));

const validParameters = {
  address: "0x1234567890123456789012345678901234567890" as Address,
  controller: "0x0987654321098765432109876543210987654321" as Address,
};

// @ts-expect-error - We only create an empty client for testing purposes
const client: Client = {};

describe("maxMint", function () {
  it("should pass the controller as the erc-4626 receiver", async function () {
    await maxMint(client, validParameters);

    expect(erc4626MaxMint).toHaveBeenCalledWith(client, {
      address: validParameters.address,
      receiver: validParameters.controller,
    });
  });
});
