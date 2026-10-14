import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { sVetBtcAddress, sVusdAddress } from "@vetro-protocol/core";
import { type Address, type Hex, parseUnits } from "viem";
import { revert, snapshot } from "viem/actions";
import { approve, symbol } from "viem-erc20/actions";
import { deposit, totalAssets } from "viem-erc4626/actions";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  confirmWrite,
  createClients,
  fundTestAccount,
  runCli,
  runCliRaw,
  usdc,
  vetBtc,
  vusd,
} from "./helpers.ts";

describe("variable-yield total-assets", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient, testClient, walletClient } = createClients(rpcUrl);

  const totalAssetsOnFork = (extra: string[] = []) => [
    "variable-yield",
    "total-assets",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  const stake = async function ({
    amount,
    token,
    vault,
  }: {
    amount: bigint;
    token: Address;
    vault: Address;
  }) {
    const approvalHash = await approve(walletClient, {
      address: token,
      amount,
      spender: vault,
    });
    await confirmWrite({ client: publicClient, hash: approvalHash });
    const hash = await deposit(walletClient, {
      address: vault,
      assets: amount,
      receiver: TEST_ADDRESS,
    });
    await confirmWrite({ client: publicClient, hash });
  };

  let snapshotId: Hex;

  beforeAll(async function () {
    snapshotId = await snapshot(testClient);
    await fundTestAccount({ amount: "1000", rpcUrl, token: vusd });
    await fundTestAccount({ amount: "1", rpcUrl, token: vetBtc });
    await stake({
      amount: parseUnits("250", vusd.decimals),
      token: vusd.address,
      vault: sVusdAddress,
    });
    await stake({
      amount: parseUnits("0.25", vetBtc.decimals),
      token: vetBtc.address,
      vault: sVetBtcAddress,
    });
  });

  afterAll(() => revert(testClient, { id: snapshotId }));

  it.for([
    { token: vusd, vault: sVusdAddress },
    { token: vetBtc, vault: sVetBtcAddress },
  ])(
    "reads the total assets of $token.symbol by pegged or share token, by symbol or address",
    async function ({ token, vault }) {
      const expected = await totalAssets(publicClient, { address: vault });
      expect(expected).toBeGreaterThan(0n);
      const shareSymbol = await symbol(publicClient, { address: vault });

      const totals: string[] = [];
      for (const value of [token.symbol, token.address, shareSymbol, vault]) {
        totals.push(await runCli(totalAssetsOnFork(["--token", value])));
      }

      expect(totals).toEqual(Array(4).fill(expected.toString()));
    },
  );

  it("rejects a token that is not pegged or share", async function () {
    const { exitCode, stderr } = await runCliRaw(
      totalAssetsOnFork(["--token", usdc.symbol]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a pegged or share token: "${usdc.symbol}"`,
    );
  });

  it("rejects a missing --token", async function () {
    const { exitCode, stderr } = await runCliRaw(totalAssetsOnFork());
    expect(exitCode).toBe(1);
    expect(stderr).toContain("required option '--token <token>'");
  });
});
