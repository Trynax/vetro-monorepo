import { type Address, type Client } from "viem";
import { claimableDepositRequest as erc7540ClaimableDepositRequest } from "viem-erc7540/actions";
import { describe, expect, it, vi } from "vitest";

import { claimableDepositRequest } from "../../src/actions/public/claimableDepositRequest.ts";

vi.mock("viem-erc7540/actions", () => ({
  claimableDepositRequest: vi.fn(),
}));

const validParameters = {
  address: "0x1234567890123456789012345678901234567890" as Address,
  controller: "0x0987654321098765432109876543210987654321" as Address,
};

// @ts-expect-error - We only create an empty client for testing purposes
const client: Client = {};

describe("claimableDepositRequest", function () {
  it("should read the request with id 0", async function () {
    await claimableDepositRequest(client, validParameters);

    expect(erc7540ClaimableDepositRequest).toHaveBeenCalledExactlyOnceWith(
      client,
      {
        address: validParameters.address,
        controller: validParameters.controller,
        requestId: 0n,
      },
    );
  });
});
