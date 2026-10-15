import { sVetBtcAddress, sVusdAddress } from "@vetro-protocol/core";
import {
  getCooldownEnabled,
  getInstantWithdrawWhitelist,
} from "@vetro-protocol/earn/actions";
import { symbol } from "viem-erc20/actions";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  createClients,
  runCli,
  runCliRaw,
  setInstantWithdrawWhitelisted,
  setStakingCooldown,
  usdc,
  vetBtc,
  vusd,
} from "./helpers.ts";

describe("variable-yield is-instant-withdraw", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient } = createClients(rpcUrl);
  const account = "0x00000000000000000000000000000000000000A1";
  const vaults = [sVusdAddress, sVetBtcAddress];

  const isInstantWithdrawOnFork = (extra: string[] = []) => [
    "variable-yield",
    "is-instant-withdraw",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  const setVaultState = async function ({
    cooldownEnabled,
    vault,
    whitelisted,
  }: {
    cooldownEnabled: boolean;
    vault: (typeof vaults)[number];
    whitelisted: boolean;
  }) {
    await setStakingCooldown({ enabled: cooldownEnabled, rpcUrl, vault });
    await setInstantWithdrawWhitelisted({
      account,
      rpcUrl,
      vault,
      whitelisted,
    });
  };

  let before: { cooldownEnabled: boolean; whitelisted: boolean }[];

  beforeAll(async function () {
    before = await Promise.all(
      vaults.map(async (vault) => ({
        cooldownEnabled: await getCooldownEnabled(publicClient, {
          address: vault,
        }),
        whitelisted: await getInstantWithdrawWhitelist(publicClient, {
          account,
          address: vault,
        }),
      })),
    );
  });

  afterAll(async function () {
    for (const [index, vault] of vaults.entries()) {
      await setVaultState({ ...before[index], vault });
    }
  });

  it("prints true when the cooldown is disabled", async function () {
    await setVaultState({
      cooldownEnabled: false,
      vault: sVusdAddress,
      whitelisted: false,
    });

    const instant = await runCli<boolean>(
      isInstantWithdrawOnFork(["--token", vusd.symbol, "--account", account]),
    );

    expect(instant).toBe(true);
  });

  it("prints false when the cooldown is enabled and the account is not whitelisted, by pegged or share token, by symbol or address", async function () {
    await setVaultState({
      cooldownEnabled: true,
      vault: sVusdAddress,
      whitelisted: false,
    });
    const shareSymbol = await symbol(publicClient, { address: sVusdAddress });

    const results: boolean[] = [];
    for (const token of [
      vusd.symbol,
      vusd.address,
      shareSymbol,
      sVusdAddress,
    ]) {
      results.push(
        await runCli<boolean>(
          isInstantWithdrawOnFork(["--token", token, "--account", account]),
        ),
      );
    }

    expect(results).toEqual(Array(4).fill(false));
  });

  it("prints true when the cooldown is enabled and the account is whitelisted", async function () {
    await setVaultState({
      cooldownEnabled: true,
      vault: sVusdAddress,
      whitelisted: true,
    });

    const instant = await runCli<boolean>(
      isInstantWithdrawOnFork(["--token", vusd.symbol, "--account", account]),
    );

    expect(instant).toBe(true);
  });

  it("reads the vault of the given token", async function () {
    await setVaultState({
      cooldownEnabled: true,
      vault: sVusdAddress,
      whitelisted: false,
    });
    await setVaultState({
      cooldownEnabled: true,
      vault: sVetBtcAddress,
      whitelisted: true,
    });

    const results: boolean[] = [];
    for (const token of [vusd.symbol, vetBtc.symbol]) {
      results.push(
        await runCli<boolean>(
          isInstantWithdrawOnFork(["--token", token, "--account", account]),
        ),
      );
    }

    expect(results).toEqual([false, true]);
  });

  it("accepts a non-checksummed account address", async function () {
    await setVaultState({
      cooldownEnabled: true,
      vault: sVusdAddress,
      whitelisted: true,
    });

    const instant = await runCli<boolean>(
      isInstantWithdrawOnFork([
        "--token",
        vusd.symbol,
        "--account",
        account.toLowerCase(),
      ]),
    );

    expect(instant).toBe(true);
  });

  it("rejects a token that is not pegged or share", async function () {
    const { exitCode, stderr } = await runCliRaw(
      isInstantWithdrawOnFork(["--token", usdc.symbol, "--account", account]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a pegged or share token: "${usdc.symbol}"`,
    );
  });

  it("rejects an invalid --account", async function () {
    const { exitCode, stderr } = await runCliRaw(
      isInstantWithdrawOnFork([
        "--token",
        vusd.symbol,
        "--account",
        "notanaddress",
      ]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid address: "notanaddress"');
  });

  it.for([
    [["--account", account], "required option '--token <token>'"],
    [["--token", vusd.symbol], "required option '--account <addr>'"],
  ] as const)(
    "rejects a missing option: %s",
    async function ([extra, message]) {
      const { exitCode, stderr } = await runCliRaw(
        isInstantWithdrawOnFork([...extra]),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain(message);
    },
  );
});
