import {
  encodeDeposit,
  getMaxMint,
  previewDeposit,
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
  isTokenMatch,
  resolveWhitelistedToken,
} from "../../../lib/tokens.ts";

export function register(swap: Command) {
  swap
    .command("mint")
    .description("Print the deposit calldata to swap a whitelisted token in")
    .requiredOption(
      "--from <token>",
      "Whitelisted token to deposit, by symbol or address",
    )
    .option(
      "--to <token>",
      "Pegged token to receive, by symbol or address; inferred from --from when omitted",
    )
    .requiredOption("--amount <n>", "Amount in human units", parseAmount)
    .requiredOption(
      "--receiver <addr>",
      "Address receiving the pegged token",
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
        from: string;
        receiver: Address;
        slippage: number;
        to?: string;
      },
      command: Command,
    ) {
      const { chainId, client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const tokenIn = await resolveWhitelistedToken({
        client,
        value: options.from,
      });

      if (options.to !== undefined) {
        const peggedToken = await getGatewayPeggedToken({
          client,
          gatewayAddress: tokenIn.gatewayAddress,
        });
        if (!isTokenMatch({ token: peggedToken, value: options.to })) {
          throw new Error(
            `"${options.to}" is not the pegged token minted from "${options.from}" (expected ${peggedToken.symbol})`,
          );
        }
      }

      const amountIn = parseTokenAmount({
        amount: options.amount,
        decimals: tokenIn.decimals,
        token: options.from,
      });

      const [peggedTokenOut, maxMint, { depositActive }] = await Promise.all([
        previewDeposit(client, {
          address: tokenIn.gatewayAddress,
          amountIn,
          tokenIn: tokenIn.address,
        }),
        getMaxMint(client, { address: tokenIn.gatewayAddress }),
        readGatewayTokenConfig({
          client,
          gatewayAddress: tokenIn.gatewayAddress,
          token: tokenIn.address,
        }),
      ]);

      if (!depositActive) {
        throw new Error(`Minting from "${options.from}" is paused`);
      }

      if (peggedTokenOut > maxMint) {
        const peggedToken = await getGatewayPeggedToken({
          client,
          gatewayAddress: tokenIn.gatewayAddress,
        });
        const format = (value: bigint) =>
          `${formatUnits(value, peggedToken.decimals)} ${peggedToken.symbol}`;
        throw new Error(
          `Amount exceeds the mint limit: it would mint ${format(peggedTokenOut)}, above the ${format(maxMint)} the gateway can still mint`,
        );
      }

      const minPeggedTokenOut = applySlippage({
        preview: peggedTokenOut,
        slippage: options.slippage,
      });

      printTransactionRequest({
        chainId,
        data: encodeDeposit({
          amountIn,
          minPeggedTokenOut,
          receiver: options.receiver,
          tokenIn: tokenIn.address,
        }),
        to: tokenIn.gatewayAddress,
      });
    });
}
