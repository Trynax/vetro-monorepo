import { type Command } from "commander";
import { type Address } from "viem";
import { balanceOf } from "viem-erc20/actions";

import { parseAddress } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { resolveStakingToken } from "../../../lib/tokens.ts";

export function register(variableYield: Command) {
  variableYield
    .command("position")
    .description(
      "Print the staked position of an account, as its share token balance",
    )
    .requiredOption(
      "--token <token>",
      "Pegged token or its share token, by symbol or address",
    )
    .requiredOption("--account <addr>", "Share token owner", parseAddress)
    .action(async function (
      options: { account: Address; token: string },
      command: Command,
    ) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const { stakingVault } = await resolveStakingToken({
        client,
        value: options.token,
      });

      const shares = await balanceOf(client, {
        account: options.account,
        address: stakingVault,
      });
      printResult(shares);
    });
}
