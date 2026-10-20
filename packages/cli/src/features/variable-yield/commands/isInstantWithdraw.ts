import {
  getCooldownEnabled,
  getInstantWithdrawWhitelist,
} from "@vetro-protocol/earn/actions";
import { type Command } from "commander";
import { type Address } from "viem";

import { parseAddress } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { resolveStakingToken } from "../../../lib/tokens.ts";

export function register(variableYield: Command) {
  variableYield
    .command("is-instant-withdraw")
    .description(
      "Print whether an address can unstake with no cooldown: the vault's cooldown is disabled, or the address is on its instant-withdraw whitelist",
    )
    .requiredOption(
      "--token <token>",
      "Pegged token or its share token, by symbol or address",
    )
    .requiredOption("--account <addr>", "Address to check", parseAddress)
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

      const cooldownEnabled = await getCooldownEnabled(client, {
        address: stakingVault,
      });
      if (!cooldownEnabled) {
        printResult(true);
        return;
      }

      printResult(
        await getInstantWithdrawWhitelist(client, {
          account: options.account,
          address: stakingVault,
        }),
      );
    });
}
