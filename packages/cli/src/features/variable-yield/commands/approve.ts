import { type Command } from "commander";
import { encodeApproveData } from "viem-erc20/actions";

import { parseNonNegativeAmount, parseTokenAmount } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printTransactionRequest } from "../../../lib/output.ts";
import { resolveStakablePeggedToken } from "../../../lib/tokens.ts";

export function register(variableYield: Command) {
  variableYield
    .command("approve")
    .description("Print the approval calldata for a stake")
    .requiredOption(
      "--token <token>",
      "Pegged token to approve, by symbol or address",
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
      const peggedToken = await resolveStakablePeggedToken({
        client,
        value: options.token,
      });
      printTransactionRequest({
        chainId,
        data: encodeApproveData({
          amount: parseTokenAmount({
            amount: options.amount,
            decimals: peggedToken.decimals,
            token: options.token,
          }),
          spender: peggedToken.stakingVault,
        }),
        to: peggedToken.address,
      });
    });
}
