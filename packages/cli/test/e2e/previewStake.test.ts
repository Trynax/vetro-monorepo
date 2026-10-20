import { sVusdAddress } from "@vetro-protocol/core";
import { parseUnits } from "viem";
import { previewDeposit } from "viem-erc4626/actions";
import { describe, expect, inject, it } from "vitest";

import {
  createClients,
  runCli,
  runCliRaw,
  swapAmount,
  usdc,
  vusd,
} from "./helpers.ts";

describe("variable-yield preview-stake", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient } = createClients(rpcUrl);

  const previewStakeOnFork = (extra: string[] = []) => [
    "variable-yield",
    "preview-stake",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  it("reads the preview by symbol", async function () {
    const preview = await runCli(
      previewStakeOnFork(["--token", vusd.symbol, "--amount", swapAmount]),
    );
    const expected = await previewDeposit(publicClient, {
      address: sVusdAddress,
      assets: parseUnits(swapAmount, vusd.decimals),
    });
    expect(preview).toBe(expected.toString());
  });

  it("reads the same preview by address as by symbol", async function () {
    const bySymbol = await runCli(
      previewStakeOnFork(["--token", vusd.symbol, "--amount", swapAmount]),
    );
    const byAddress = await runCli(
      previewStakeOnFork(["--token", vusd.address, "--amount", swapAmount]),
    );
    expect(byAddress).toBe(bySymbol);
  });

  it.for([usdc.symbol, sVusdAddress])(
    "rejects a token that is not pegged: %s",
    async function (token) {
      const { exitCode, stderr } = await runCliRaw(
        previewStakeOnFork(["--token", token, "--amount", swapAmount]),
      );
      expect(exitCode).toBe(1);
      expect(JSON.parse(stderr).error).toBe(`Not a pegged token: "${token}"`);
    },
  );

  it.for([
    [["--amount", swapAmount], "required option '--token <token>'"],
    [["--token", vusd.symbol], "required option '--amount <n>'"],
  ] as const)(
    "rejects a missing option: %s",
    async function ([extra, message]) {
      const { exitCode, stderr } = await runCliRaw(
        previewStakeOnFork([...extra]),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain(message);
    },
  );

  it("rejects an amount with more decimals than the token supports", async function () {
    const { exitCode, stderr } = await runCliRaw(
      previewStakeOnFork([
        "--token",
        vusd.symbol,
        "--amount",
        "0.0000000000000000001",
      ]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount has more decimals than "${vusd.symbol}" supports: ${vusd.decimals}`,
    );
  });

  it("rejects an amount that mints zero", async function () {
    const { exitCode, stderr } = await runCliRaw(
      previewStakeOnFork([
        "--token",
        vusd.symbol,
        "--amount",
        "0.000000000000000001",
      ]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount is too small to stake "${vusd.symbol}": it mints 0`,
    );
  });

  it.for(["0", "abc", "-1"])(
    "rejects --amount %s as a usage error",
    async function (amount) {
      const { exitCode, stderr } = await runCliRaw(
        previewStakeOnFork(["--token", vusd.symbol, "--amount", amount]),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("option '--amount");
    },
  );
});
