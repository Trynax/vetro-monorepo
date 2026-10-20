import { type Command } from "commander";
import { type Address } from "viem";
import { allowance } from "viem-erc20/actions";

import { parseAddress } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { resolveSwapToken } from "../../../lib/tokens.ts";

export function register(swap: Command) {
  swap
    .command("allowance")
    .description("Print how much of a token the gateway is allowed to spend")
    .requiredOption(
      "--token <token>",
      "Whitelisted or pegged token to check, by symbol or address",
    )
    .requiredOption("--account <addr>", "Token owner", parseAddress)
    .action(async function (
      options: { account: Address; token: string },
      command: Command,
    ) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const token = await resolveSwapToken({
        client,
        value: options.token,
      });
      const approved = await allowance(client, {
        address: token.address,
        owner: options.account,
        spender: token.gatewayAddress,
      });
      printResult(approved);
    });
}
