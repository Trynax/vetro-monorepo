import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { sVetBtcAddress, sVusdAddress } from "@vetro-protocol/core";
import { type Address, type Hex, parseUnits } from "viem";
import { revert, snapshot } from "viem/actions";
import { approve, balanceOf, symbol } from "viem-erc20/actions";
import { deposit } from "viem-erc4626/actions";
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

describe("variable-yield position", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient, testClient, walletClient } = createClients(rpcUrl);

  const positionOnFork = (extra: string[] = []) => [
    "variable-yield",
    "position",
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

  const readShares = (vault: Address) =>
    balanceOf(publicClient, { account: TEST_ADDRESS, address: vault }).then(
      (b) => b.toString(),
    );

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
    "reads the position of $token.symbol by pegged or share token, by symbol or address",
    async function ({ token, vault }) {
      const expected = await readShares(vault);
      const shareSymbol = await symbol(publicClient, { address: vault });

      const positions: string[] = [];
      for (const value of [token.symbol, token.address, shareSymbol, vault]) {
        positions.push(
          await runCli(
            positionOnFork(["--token", value, "--account", TEST_ADDRESS]),
          ),
        );
      }

      expect(positions).toEqual(Array(4).fill(expected));
    },
  );

  it("rejects a token that is not pegged or share", async function () {
    const { exitCode, stderr } = await runCliRaw(
      positionOnFork(["--token", usdc.symbol, "--account", TEST_ADDRESS]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a pegged or share token: "${usdc.symbol}"`,
    );
  });

  it("rejects an invalid --account", async function () {
    const { exitCode, stderr } = await runCliRaw(
      positionOnFork(["--token", vusd.symbol, "--account", "notanaddress"]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid address: "notanaddress"');
  });

  it.for([
    [["--account", TEST_ADDRESS], "required option '--token <token>'"],
    [["--token", vusd.symbol], "required option '--account <addr>'"],
  ] as const)(
    "rejects a missing option: %s",
    async function ([extra, message]) {
      const { exitCode, stderr } = await runCliRaw(positionOnFork([...extra]));
      expect(exitCode).toBe(1);
      expect(stderr).toContain(message);
    },
  );
});
