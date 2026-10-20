import { previewDeposit } from "@vetro-protocol/gateway/actions";
import { type Command } from "commander";

import { parseAmount, parseTokenAmount } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { resolveWhitelistedToken } from "../../../lib/tokens.ts";

export function register(swap: Command) {
  swap
    .command("preview-mint")
    .description(
      "Print the pegged token that would be minted for a whitelisted token deposit, in the pegged token's decimals",
    )
    .requiredOption(
      "--from <token>",
      "Whitelisted token to deposit, by symbol or address",
    )
    .requiredOption("--amount <n>", "Amount in human units", parseAmount)
    .action(async function (
      options: { amount: string; from: string },
      command: Command,
    ) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const tokenIn = await resolveWhitelistedToken({
        client,
        value: options.from,
      });

      const amountIn = parseTokenAmount({
        amount: options.amount,
        decimals: tokenIn.decimals,
        token: options.from,
      });

      const peggedTokenOut = await previewDeposit(client, {
        address: tokenIn.gatewayAddress,
        amountIn,
        tokenIn: tokenIn.address,
      });
      printResult(peggedTokenOut);
    });
}
