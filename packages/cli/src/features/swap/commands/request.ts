import { getRedeemRequest } from "@vetro-protocol/gateway/actions";
import { type Command } from "commander";
import { type Address } from "viem";
import { getBlock } from "viem/actions";

import { parseAddress, parseGateway } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";

const getStatus = function ({
  claimableAt,
  timestamp,
}: {
  claimableAt: bigint;
  timestamp: bigint;
}) {
  if (claimableAt === 0n) {
    return "none";
  }
  return timestamp >= claimableAt ? "ready" : "cooldown";
};

export function register(swap: Command) {
  swap
    .command("request")
    .description("Print the account's open redeem request on the gateway")
    .requiredOption(
      "--account <addr>",
      "Address that owns the request",
      parseAddress,
    )
    .requiredOption("--gateway <addr>", "Gateway address", parseGateway)
    .action(async function (
      options: { account: Address; gateway: Address },
      command: Command,
    ) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const [[amountLocked, claimableAt], { timestamp }] = await Promise.all([
        getRedeemRequest(client, {
          address: options.gateway,
          user: options.account,
        }),
        getBlock(client),
      ]);
      printResult({
        amountLocked,
        claimableAt,
        status: getStatus({ claimableAt, timestamp }),
      });
    });
}
