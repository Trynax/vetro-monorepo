import { isAddress, isAddressEqual } from "viem";
import { asset } from "viem-erc4626/actions";
import { describe, expect, inject, it } from "vitest";

import { type TokenConfig } from "../../src/lib/tokenConfig.ts";

import { createClients, runCli, runCliRaw, usdc, vusd } from "./helpers.ts";

// `printResult` serializes every bigint, so the emitted `stalePeriod` is a
// decimal string rather than the `bigint` the helper returns.
type SerializedTokenConfig = Omit<TokenConfig, "stalePeriod"> & {
  stalePeriod: string;
};

describe("swap token-config", function () {
  const rpcUrl = inject("anvilUrl");
  const tokenConfigOnFork = (extra: string[] = []) => [
    "swap",
    "token-config",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  it("reads the config by symbol", async function () {
    const config = await runCli<SerializedTokenConfig>(
      tokenConfigOnFork(["--token", usdc.symbol]),
    );

    expect(config.decimals).toBe(usdc.decimals);
    expect(typeof config.depositActive).toBe("boolean");
    expect(typeof config.withdrawActive).toBe("boolean");
    expect(isAddress(config.oracle)).toBe(true);
    expect(typeof BigInt(config.stalePeriod)).toBe("bigint");

    const { publicClient } = createClients(rpcUrl);
    const vaultAsset = await asset(publicClient, { address: config.vault });
    expect(isAddressEqual(vaultAsset, usdc.address)).toBe(true);
  });

  it("reads the same config by a non-checksummed address as by symbol", async function () {
    const bySymbol = await runCli<SerializedTokenConfig>(
      tokenConfigOnFork(["--token", usdc.symbol]),
    );
    const byAddress = await runCli<SerializedTokenConfig>(
      tokenConfigOnFork(["--token", usdc.address.toLowerCase()]),
    );
    expect(byAddress).toEqual(bySymbol);
  });

  it("rejects a pegged token", async function () {
    const { exitCode, stderr } = await runCliRaw(
      tokenConfigOnFork(["--token", vusd.symbol]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a whitelisted token: "${vusd.symbol}"`,
    );
  });

  it("rejects a token that is not whitelisted", async function () {
    const { exitCode, stderr } = await runCliRaw(
      tokenConfigOnFork(["--token", "NOTATOKEN"]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      'Not a whitelisted token: "NOTATOKEN"',
    );
  });

  it("rejects a missing --token", async function () {
    const { exitCode, stderr } = await runCliRaw(tokenConfigOnFork());
    expect(exitCode).toBe(1);
    expect(stderr).toContain("required option '--token <token>'");
  });
});
