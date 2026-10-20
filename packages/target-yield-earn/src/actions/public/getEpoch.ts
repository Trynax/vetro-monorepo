import { isAddressValid } from "@vetro-protocol/core";
import { type Address, type Client } from "viem";
import { readContract } from "viem/actions";

import { targetYieldEarnVaultAbi } from "../../abi/targetYieldEarnVaultAbi.ts";

export async function getEpoch(
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

  const epoch = await readContract(client, {
    abi: targetYieldEarnVaultAbi,
    address: parameters.address,
    args: [parameters.epochId],
    functionName: "getEpoch",
  });

  // Convert durations to timestamps
  return {
    accrualInterval: {
      end: epoch.end,
      start: epoch.end - epoch.accrualInterval,
    },
    deposits: epoch.deposits,
    end: epoch.end,
    entryWindow: {
      end: epoch.start + epoch.entryWindow,
      start: epoch.start,
    },
    exitWindow: {
      end: epoch.end,
      start: epoch.end - epoch.exitWindow,
    },
    maxDeposits: epoch.maxDeposits,
    rate: epoch.rate,
    start: epoch.start,
  };
}
