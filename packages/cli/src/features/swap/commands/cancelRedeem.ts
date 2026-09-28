import {
  encodeCancelRedeemRequest,
  getRedeemRequest,
} from "@vetro-protocol/gateway/actions";
import { type Command } from "commander";
import { type Address } from "viem";

import { parseAddress, parseGateway } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printTransactionRequest } from "../../../lib/output.ts";

export function register(swap: Command) {
  swap
    .command("cancel-redeem")
    .description(
      "Print the calldata to cancel the account's open redeem request",
    )
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
      const { chainId, client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const [, claimableAt] = await getRedeemRequest(client, {
        address: options.gateway,
        user: options.account,
      });
      if (claimableAt === 0n) {
        throw new Error(
          `No open redeem request for "${options.account}" on the gateway`,
        );
      }

      printTransactionRequest({
        chainId,
        data: encodeCancelRedeemRequest(),
        to: options.gateway,
      });
    });
}
