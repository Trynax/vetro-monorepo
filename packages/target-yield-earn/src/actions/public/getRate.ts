import { isAddressValid } from "@vetro-protocol/core";
import { type Address, type Client } from "viem";
import { readContract } from "viem/actions";

import { targetYieldEarnVaultAbi } from "../../abi/targetYieldEarnVaultAbi.ts";

export async function getRate(
  client: Client,
  parameters: {
    address: Address;
    epochId: bigint;
  },
) {
  if (!client) {
    throw new Error("Client is not defined");
  }

  if (!parameters) {
    throw new Error("Parameters are required");
  }

  if (!isAddressValid(parameters.address)) {
    throw new Error("Vault address is invalid");
  }

  if (typeof parameters.epochId !== "bigint") {
    throw new Error("Epoch ID must be a bigint");
  }

  return readContract(client, {
    abi: targetYieldEarnVaultAbi,
    address: parameters.address,
    args: [parameters.epochId],
    functionName: "rate",
  });
}
