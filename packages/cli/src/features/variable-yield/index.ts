import { type Command } from "commander";

import { register as allowance } from "./commands/allowance.ts";
import { register as cooldown } from "./commands/cooldown.ts";
import { register as previewStake } from "./commands/previewStake.ts";

const variableYieldCommands = [allowance, cooldown, previewStake];

export function register(program: Command) {
  const variableYield = program
    .command("variable-yield")
    .description("Stake assets to earn variable yield.");

  variableYieldCommands.forEach((registerCommand) =>
    registerCommand(variableYield),
  );
}
