import { isAddressValid } from "@vetro-protocol/core";
import { type Address, type Client } from "viem";
import { readContract } from "viem/actions";

import { targetYieldEarnVaultAbi } from "../../abi/targetYieldEarnVaultAbi.ts";

export async function getIsShutdown(
  client: Client,
  parameters: {
    address: Address;
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

  return readContract(client, {
    abi: targetYieldEarnVaultAbi,
    address: parameters.address,
    functionName: "isShutdown",
  });
}
