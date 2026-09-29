import { previewRedeem } from "@vetro-protocol/gateway/actions";
import { type Command } from "commander";

import { parseAmount, parseTokenAmount } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import {
  getGatewayPeggedToken,
  resolveWhitelistedToken,
} from "../../../lib/tokens.ts";

export function register(swap: Command) {
  swap
    .command("preview-redeem")
    .description(
      "Print the whitelisted token that a pegged token redeem would pay out, in the whitelisted token's decimals",
    )
    .requiredOption(
      "--to <token>",
      "Whitelisted token to receive, by symbol or address",
    )
    .requiredOption(
      "--amount <n>",
      "Pegged token amount in human units",
      parseAmount,
    )
    .action(async function (
      options: { amount: string; to: string },
      command: Command,
    ) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const tokenOut = await resolveWhitelistedToken({
        client,
        value: options.to,
      });
      const peggedToken = await getGatewayPeggedToken({
        client,
        gatewayAddress: tokenOut.gatewayAddress,
      });

      const peggedTokenIn = parseTokenAmount({
        amount: options.amount,
        decimals: peggedToken.decimals,
        token: peggedToken.symbol,
      });

      const amountOut = await previewRedeem(client, {
        address: tokenOut.gatewayAddress,
        peggedTokenIn,
        tokenOut: tokenOut.address,
      });
      if (amountOut === 0n) {
        throw new Error(
          `Amount is too small to redeem into "${options.to}": it pays out 0`,
        );
      }
      printResult(amountOut);
    });
}
