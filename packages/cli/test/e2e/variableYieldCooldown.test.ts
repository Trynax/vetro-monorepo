import { sVetBtcAddress, sVusdAddress } from "@vetro-protocol/core";
import {
  getCooldownDuration,
  getCooldownEnabled,
} from "@vetro-protocol/earn/actions";
import { symbol } from "viem-erc20/actions";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  createClients,
  runCli,
  runCliRaw,
  setStakingCooldown,
  usdc,
  vusd,
} from "./helpers.ts";

describe("variable-yield cooldown", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient } = createClients(rpcUrl);
  const day = 86_400n;
  const sVusdDuration = 2n * day;
  const sVetBtcDuration = 3n * day;
  const vaults = [sVusdAddress, sVetBtcAddress];

  const cooldownOnFork = (extra: string[] = []) => [
    "variable-yield",
    "cooldown",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  let before: { duration: bigint; enabled: boolean }[];

  beforeAll(async function () {
    before = await Promise.all(
      vaults.map(async (vault) => ({
        duration: await getCooldownDuration(publicClient, { address: vault }),
        enabled: await getCooldownEnabled(publicClient, { address: vault }),
      })),
    );
  });

  afterAll(async function () {
    // Both vaults share an owner, so parallel writes would reuse a nonce.
    for (const [index, vault] of vaults.entries()) {
      await setStakingCooldown({ ...before[index], rpcUrl, vault });
    }
  });

  it("prints the cooldown duration by pegged or share token, by symbol or address", async function () {
    await setStakingCooldown({
      duration: sVusdDuration,
      enabled: true,
      rpcUrl,
      vault: sVusdAddress,
    });
    const shareSymbol = await symbol(publicClient, { address: sVusdAddress });

    const cooldowns: string[] = [];
    for (const token of [
      vusd.symbol,
      vusd.address,
      shareSymbol,
      sVusdAddress,
    ]) {
      cooldowns.push(await runCli(cooldownOnFork(["--token", token])));
    }

    expect(cooldowns).toEqual(Array(4).fill(sVusdDuration.toString()));
  });

  it("reads the vault of the given token", async function () {
    await setStakingCooldown({
      duration: sVusdDuration,
      enabled: true,
      rpcUrl,
      vault: sVusdAddress,
    });
    await setStakingCooldown({
      duration: sVetBtcDuration,
      enabled: true,
      rpcUrl,
      vault: sVetBtcAddress,
    });

    const cooldown = await runCli(cooldownOnFork(["--token", sVetBtcAddress]));

    expect(cooldown).toBe(sVetBtcDuration.toString());
  });

  it("prints 0 when the cooldown is disabled", async function () {
    await setStakingCooldown({
      duration: sVusdDuration,
      enabled: false,
      rpcUrl,
      vault: sVusdAddress,
    });

    const cooldown = await runCli(cooldownOnFork(["--token", vusd.symbol]));

    expect(cooldown).toBe("0");
  });

  it("rejects a token that is not pegged or share", async function () {
    const { exitCode, stderr } = await runCliRaw(
      cooldownOnFork(["--token", usdc.symbol]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a pegged or share token: "${usdc.symbol}"`,
    );
  });

  it("rejects a missing --token", async function () {
    const { exitCode, stderr } = await runCliRaw(cooldownOnFork());
    expect(exitCode).toBe(1);
    expect(stderr).toContain("required option '--token <token>'");
  });
});
