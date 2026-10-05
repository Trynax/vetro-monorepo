import { describe, expect, it } from "vitest";

import { createProgram } from "../src/program.ts";

import { runCliRaw } from "./e2e/helpers.ts";

describe("help", function () {
  it.for([["gateways"], ["swap"], ["swap", "mint"]])(
    "lists --rpc-url in the help of %s",
    async function (command) {
      const { exitCode, stdout } = await runCliRaw([...command, "--help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("--rpc-url <url>");
    },
  );

  it("marks only the required options as required", async function () {
    const mint = createProgram()
      .commands.find((command) => command.name() === "swap")!
      .commands.find((command) => command.name() === "mint")!;
    const { stdout } = await runCliRaw(["swap", "mint", "--help"]);
    expect(stdout.match(/\(required\)/g)).toHaveLength(
      mint.options.filter((option) => option.mandatory).length,
    );
  });
});
