import { type Command } from "commander";
import { previewDeposit } from "viem-erc4626/actions";

import { parseAmount, parseTokenAmount } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { resolveStakablePeggedToken } from "../../../lib/tokens.ts";

export function register(variableYield: Command) {
  variableYield
    .command("preview-stake")
    .description(
      "Print the share token that a stake of the pegged token would mint, in the share token's decimals",
    )
    .requiredOption(
      "--token <token>",
      "Pegged token to stake, by symbol or address",
    )
    .requiredOption("--amount <n>", "Amount in human units", parseAmount)
    .action(async function (
      options: { amount: string; token: string },
      command: Command,
    ) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const peggedToken = await resolveStakablePeggedToken({
        client,
        value: options.token,
      });

      const assets = parseTokenAmount({
        amount: options.amount,
        decimals: peggedToken.decimals,
        token: options.token,
      });

      const shares = await previewDeposit(client, {
        address: peggedToken.stakingVault,
        assets,
      });
      if (shares === 0n) {
        throw new Error(
          `Amount is too small to stake "${options.token}": it mints 0`,
        );
      }
      printResult(shares);
    });
}
