import {
  getCooldownDuration,
  getCooldownEnabled,
} from "@vetro-protocol/earn/actions";
import { type Command } from "commander";

import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { resolveStakingToken } from "../../../lib/tokens.ts";

export function register(variableYield: Command) {
  variableYield
    .command("cooldown")
    .description("Print the staking vault's unstake cooldown, in seconds")
    .requiredOption(
      "--token <token>",
      "Pegged token or its share token, by symbol or address",
    )
    .action(async function (options: { token: string }, command: Command) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const { stakingVault } = await resolveStakingToken({
        client,
        value: options.token,
      });

      const [enabled, duration] = await Promise.all([
        getCooldownEnabled(client, { address: stakingVault }),
        getCooldownDuration(client, { address: stakingVault }),
      ]);
      printResult(enabled ? duration : 0n);
    });
}
