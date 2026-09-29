import { type Command } from "commander";
import { encodeApproveData } from "viem-erc20/actions";

import { parseNonNegativeAmount, parseTokenAmount } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printTransactionRequest } from "../../../lib/output.ts";
import { resolveSwapToken } from "../../../lib/tokens.ts";

export function register(swap: Command) {
  swap
    .command("approve")
    .description("Print the approval calldata for a swap")
    .requiredOption(
      "--token <token>",
      "Whitelisted or pegged token to approve, by symbol or address",
    )
    .requiredOption(
      "--amount <n>",
      "Amount in human units, 0 to reset the allowance",
      parseNonNegativeAmount,
    )
    .action(async function (
      options: { amount: string; token: string },
      command: Command,
    ) {
      const { chainId, client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const token = await resolveSwapToken({
        client,
        value: options.token,
      });
      printTransactionRequest({
        chainId,
        data: encodeApproveData({
          amount: parseTokenAmount({
            amount: options.amount,
            decimals: token.decimals,
            token: options.token,
          }),
          spender: token.gatewayAddress,
        }),
        to: token.address,
      });
    });
}
