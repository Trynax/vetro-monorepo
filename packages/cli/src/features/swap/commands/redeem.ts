import {
  encodeRedeem,
  getMaxWithdraw,
  previewRedeem,
} from "@vetro-protocol/gateway/actions";
import { type Command } from "commander";
import { type Address, formatUnits } from "viem";

import {
  parseAddress,
  parseAmount,
  parseSlippage,
  parseTokenAmount,
} from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printTransactionRequest } from "../../../lib/output.ts";
import { DEFAULT_SLIPPAGE, applySlippage } from "../../../lib/slippage.ts";
import { readGatewayTokenConfig } from "../../../lib/tokenConfig.ts";
import {
  getGatewayPeggedToken,
  resolveWhitelistedToken,
} from "../../../lib/tokens.ts";

export function register(swap: Command) {
  swap
    .command("redeem")
    .description(
      "Print the redeem calldata to swap a pegged token out into a whitelisted token",
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
    .requiredOption(
      "--receiver <addr>",
      "Address receiving the whitelisted token",
      parseAddress,
    )
    .option(
      "--slippage <percent>",
      "Slippage tolerance as a percent with at most one decimal, e.g. 0.5; defaults to 0, which requires the full previewed amount",
      parseSlippage,
      DEFAULT_SLIPPAGE,
    )
    .action(async function (
      options: {
        amount: string;
        receiver: Address;
        slippage: number;
        to: string;
      },
      command: Command,
    ) {
      const { chainId, client } = await createVetroClient(
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

      const [amountOut, maxWithdraw, { withdrawActive }] = await Promise.all([
        previewRedeem(client, {
          address: tokenOut.gatewayAddress,
          peggedTokenIn,
          tokenOut: tokenOut.address,
        }),
        getMaxWithdraw(client, {
          address: tokenOut.gatewayAddress,
          tokenOut: tokenOut.address,
        }),
        readGatewayTokenConfig({
          client,
          gatewayAddress: tokenOut.gatewayAddress,
          token: tokenOut.address,
        }),
      ]);

      if (!withdrawActive) {
        throw new Error(`Redeeming into "${options.to}" is paused`);
      }

      if (amountOut === 0n) {
        throw new Error(
          `Amount is too small to redeem into "${options.to}": it pays out 0`,
        );
      }

      if (amountOut > maxWithdraw) {
        const format = (value: bigint) =>
          `${formatUnits(value, tokenOut.decimals)} ${options.to}`;
        throw new Error(
          `Amount exceeds the treasury reserves: it would pay out ${format(amountOut)}, above the ${format(maxWithdraw)} the treasury holds`,
        );
      }

      const minAmountOut = applySlippage({
        preview: amountOut,
        slippage: options.slippage,
      });

      printTransactionRequest({
        chainId,
        data: encodeRedeem({
          minAmountOut,
          peggedTokenIn,
          receiver: options.receiver,
          tokenOut: tokenOut.address,
        }),
        to: tokenOut.gatewayAddress,
      });
    });
}
