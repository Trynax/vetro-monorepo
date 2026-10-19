import { type Command } from "commander";
import { type Address } from "viem";
import { allowance } from "viem-erc20/actions";

import { parseAddress } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { resolveStakablePeggedToken } from "../../../lib/tokens.ts";

export function register(variableYield: Command) {
  variableYield
    .command("allowance")
    .description(
      "Print how much of the pegged token the staking vault is allowed to spend",
    )
    .requiredOption(
      "--token <token>",
      "Pegged token to check, by symbol or address",
    )
    .requiredOption("--account <addr>", "Token owner", parseAddress)
    .action(async function (
      options: { account: Address; token: string },
      command: Command,
    ) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const peggedToken = await resolveStakablePeggedToken({
        client,
        value: options.token,
      });

      const approved = await allowance(client, {
        address: peggedToken.address,
        owner: options.account,
        spender: peggedToken.stakingVault,
      });
      printResult(approved);
    });
}
