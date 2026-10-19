import {
  encodeRequestRedeem,
  encodeRequestWithdraw,
  getCooldownEnabled,
} from "@vetro-protocol/earn/actions";
import { type Command, Option } from "commander";
import { type Address } from "viem";

import {
  parseAddress,
  parseAmount,
  parseTokenAmount,
} from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printTransactionRequest } from "../../../lib/output.ts";
import {
  getGatewayPeggedToken,
  readToken,
  resolveStakingToken,
} from "../../../lib/tokens.ts";

export function register(variableYield: Command) {
  variableYield
    .command("unstake")
    .description(
      "Print the calldata to open an exit ticket: the shares are burned, and the pegged token goes into cooldown",
    )
    .requiredOption(
      "--token <token>",
      "Pegged token or its share token, by symbol or address",
    )
    .addOption(
      new Option(
        "--amount <n>",
        "Pegged token amount in human units; one of --amount or --shares is required",
      )
        .argParser(parseAmount)
        .conflicts("shares"),
    )
    .option(
      "--shares <n>",
      "Share token amount in human units; one of --amount or --shares is required",
      parseAmount,
    )
    .requiredOption(
      "--account <addr>",
      "Share token owner, normally the signer",
      parseAddress,
    )
    .action(async function (
      options: {
        account: Address;
        amount?: string;
        shares?: string;
        token: string;
      },
      command: Command,
    ) {
      const amount = options.amount ?? options.shares;
      if (amount === undefined) {
        command.error(
          "error: one of '--amount <n>' or '--shares <n>' is required",
        );
      }
      const inShares = options.shares !== undefined;

      const { chainId, client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const { gatewayAddress, stakingVault } = await resolveStakingToken({
        client,
        value: options.token,
      });

      const [cooldownEnabled, spentToken] = await Promise.all([
        getCooldownEnabled(client, { address: stakingVault }),
        inShares
          ? readToken({ address: stakingVault, client })
          : getGatewayPeggedToken({ client, gatewayAddress }),
      ]);
      if (!cooldownEnabled) {
        throw new Error(
          `The cooldown is disabled: the vault takes a one-step withdraw for "${options.token}", which the CLI does not encode yet`,
        );
      }

      const value = parseTokenAmount({
        amount,
        decimals: spentToken.decimals,
        token: spentToken.symbol,
      });

      printTransactionRequest({
        chainId,
        data: inShares
          ? encodeRequestRedeem({ owner: options.account, shares: value })
          : encodeRequestWithdraw({ assets: value, owner: options.account }),
        to: stakingVault,
      });
    });
}
