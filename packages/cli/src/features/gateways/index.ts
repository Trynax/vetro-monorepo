import { gateways } from "@vetro-protocol/core";
import { type Command } from "commander";

import { printResult } from "../../lib/output.ts";

export function register(program: Command) {
  program
    .command("gateways")
    .description(
      "Print the enabled gateways, with their pegged token and staking vault",
    )
    .action(function () {
      printResult(
        gateways.map(({ address, peggedToken, stakingVault }) => ({
          address,
          peggedToken,
          stakingVault: stakingVault ?? null,
        })),
      );
    });
}
