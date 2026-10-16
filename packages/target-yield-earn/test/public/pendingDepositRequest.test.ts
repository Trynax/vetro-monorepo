import { type Address, type Client } from "viem";
import { pendingDepositRequest as erc7540PendingDepositRequest } from "viem-erc7540/actions";
import { describe, expect, it, vi } from "vitest";

import { pendingDepositRequest } from "../../src/actions/public/pendingDepositRequest.ts";

vi.mock("viem-erc7540/actions", () => ({
  pendingDepositRequest: vi.fn(),
}));

const validParameters = {
  address: "0x1234567890123456789012345678901234567890" as Address,
  controller: "0x0987654321098765432109876543210987654321" as Address,
};

// @ts-expect-error - We only create an empty client for testing purposes
const client: Client = {};

describe("pendingDepositRequest", function () {
  it("should read the request with id 0", async function () {
    await pendingDepositRequest(client, validParameters);

    expect(erc7540PendingDepositRequest).toHaveBeenCalledExactlyOnceWith(
      client,
      {
        address: validParameters.address,
        controller: validParameters.controller,
        requestId: 0n,
      },
    );
  });
});
