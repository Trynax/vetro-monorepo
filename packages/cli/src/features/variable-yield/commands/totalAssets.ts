import { type Command } from "commander";
import { totalAssets } from "viem-erc4626/actions";

import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { resolveStakingToken } from "../../../lib/tokens.ts";

export function register(variableYield: Command) {
  variableYield
    .command("total-assets")
    .description(
      "Print the pegged token staked in the vault, in the pegged token's decimals",
    )
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

      printResult(await totalAssets(client, { address: stakingVault }));
    });
}
