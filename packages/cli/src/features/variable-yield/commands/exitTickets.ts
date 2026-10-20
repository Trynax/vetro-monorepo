import {
  getClaimableRequests,
  getPendingRequests,
} from "@vetro-protocol/earn/actions";
import { type Command } from "commander";
import { type Address } from "viem";

import { parseAddress } from "../../../lib/args.ts";
import { type GlobalOptions, createVetroClient } from "../../../lib/client.ts";
import { printResult } from "../../../lib/output.ts";
import { resolveStakingToken } from "../../../lib/tokens.ts";

export function register(variableYield: Command) {
  variableYield
    .command("exit-tickets")
    .description(
      "Print the open exit tickets of an account: the ones in cooldown, and the ones ready to claim",
    )
    .requiredOption(
      "--token <token>",
      "Pegged token or its share token, by symbol or address",
    )
    .requiredOption("--account <addr>", "Exit ticket owner", parseAddress)
    .action(async function (
      options: { account: Address; token: string },
      command: Command,
    ) {
      const { client } = await createVetroClient(
        command.optsWithGlobals<GlobalOptions>(),
      );
      const { stakingVault } = await resolveStakingToken({
        client,
        value: options.token,
      });

      const params = { account: options.account, address: stakingVault };
      const [
        [pendingIds, pendingAssets, claimableAts],
        [readyIds, readyAssets],
      ] = await Promise.all([
        getPendingRequests(client, params),
        getClaimableRequests(client, params),
      ]);

      const cooldown = pendingIds.map((requestId, index) => ({
        assets: pendingAssets[index],
        claimableAt: claimableAts[index],
        requestId,
        status: "cooldown",
      }));
      const ready = readyIds.map((requestId, index) => ({
        assets: readyAssets[index],
        claimableAt: null,
        requestId,
        status: "ready",
      }));

      printResult(
        [...cooldown, ...ready].sort((a, b) =>
          a.requestId < b.requestId ? -1 : 1,
        ),
      );
    });
}
