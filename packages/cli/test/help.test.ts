import { describe, expect, it } from "vitest";

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
});
