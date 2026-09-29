import {
  encodeRequestRedeem,
  getWithdrawalDelayEnabled,
} from "@vetro-protocol/gateway/actions";
import { type Command } from "commander";

import { parseAmount, parseTokenAmount } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printTransactionRequest } from "../../../lib/output.ts";
import { resolvePeggedToken } from "../../../lib/tokens.ts";

export function register(swap: Command) {
  swap
    .command("send-to-queue")
    .description(
      "Print the calldata to send a pegged token to the redeem queue",
    )
    .requiredOption(
      "--from <token>",
      "Pegged token to send to the queue, by symbol or address",
    )
    .requiredOption("--amount <n>", "Amount in human units", parseAmount)
    .action(async function (
      options: { amount: string; from: string },
      command: Command,
    ) {
      const { chainId, client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const peggedToken = await resolvePeggedToken({
        client,
        value: options.from,
      });

      const delayEnabled = await getWithdrawalDelayEnabled(client, {
        address: peggedToken.gatewayAddress,
      });
      if (!delayEnabled) {
        throw new Error(
          `The redeem queue is disabled: redeem "${options.from}" in one step instead`,
        );
      }

      const peggedTokenAmount = parseTokenAmount({
        amount: options.amount,
        decimals: peggedToken.decimals,
        token: options.from,
      });

      printTransactionRequest({
        chainId,
        data: encodeRequestRedeem({ peggedTokenAmount }),
        to: peggedToken.gatewayAddress,
      });
    });
}
