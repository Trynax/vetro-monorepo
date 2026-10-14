import { getTreasury } from "@vetro-protocol/gateway/actions";
import { getWhitelistedTokens } from "@vetro-protocol/treasury/actions";
import { type Command } from "commander";
import { type Address } from "viem";

import { parseGateway } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { readTokenConfig } from "../../../lib/tokenConfig.ts";
import { readToken } from "../../../lib/tokens.ts";

export function register(swap: Command) {
  swap
    .command("whitelisted-tokens")
    .description("Print the whitelisted tokens the gateway accepts")
    .requiredOption("--gateway <addr>", "Gateway address", parseGateway)
    .action(async function (options: { gateway: Address }, command: Command) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const treasury = await getTreasury(client, { address: options.gateway });
      const tokens = await getWhitelistedTokens(client, { address: treasury });

      const whitelistedTokens = await Promise.all(
        tokens.map(async function (address) {
          const [token, { depositActive, withdrawActive }] = await Promise.all([
            readToken({ address, client }),
            readTokenConfig({ client, token: address, treasury }),
          ]);
          return {
            address,
            decimals: token.decimals,
            depositActive,
            symbol: token.symbol,
            withdrawActive,
          };
        }),
      );
      printResult(whitelistedTokens);
    });
}
