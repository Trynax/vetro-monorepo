import { Command, Option } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { register as gateways } from "./features/gateways/index.ts";
import { register as swap } from "./features/swap/index.ts";
import { parseRpcUrl } from "./lib/args.ts";
import { redactOptionValues } from "./lib/output.ts";

const features = [gateways, swap];

/**
 * The option, paired with the redactor for the usage errors it can raise.
 * Commander reports those before the endpoint is resolved and echoes the
 * offending value, so the parser keeps hold of whatever it was handed --
 * for the flag and the env var alike, including a value it rejected.
 */
const createRpcUrlOption = function () {
  let attempted: string | undefined;
  return {
    option: new Option(
      "--rpc-url <url>",
      "RPC endpoint to read from, which also determines the chain the calldata is stamped with; defaults to a public Ethereum mainnet RPC",
    )
      .argParser(function (value: string) {
        attempted = value;
        return parseRpcUrl(value);
      })
      .env("RPC_URL"),
    redactUsageError: (message: string) =>
      redactOptionValues({ message, values: [attempted, process.env.RPC_URL] }),
  };
};

export function createProgram() {
  const packageJsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "package.json",
  );
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    bin: Record<string, string>;
    description: string;
    version: string;
  };

  const program = new Command();
  const { option: rpcUrlOption, redactUsageError } = createRpcUrlOption();

  program
    .configureHelp({ showGlobalOptions: true })
    .configureOutput({
      outputError: (message, write) => write(redactUsageError(message)),
    })
    // The CLI name is the bin key (vetro-cli), not the scoped package name.
    .name(Object.keys(pkg.bin)[0])
    .description(pkg.description)
    .version(pkg.version)
    .addOption(rpcUrlOption);

  features.forEach((register) => register(program));

  return program;
}
