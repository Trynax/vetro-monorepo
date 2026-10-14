import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { sVetBtcAddress, sVusdAddress } from "@vetro-protocol/core";
import { type Address, parseUnits } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { approve } from "viem-erc20/actions";
import { beforeAll, describe, expect, inject, it } from "vitest";

import {
  createClients,
  fundTestAccount,
  runCli,
  runCliRaw,
  usdc,
  vetBtc,
  vusd,
} from "./helpers.ts";

const untouchedAccount = "0x000000000000000000000000000000000000dead";

describe("variable-yield allowance", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient, walletClient } = createClients(rpcUrl);
  const vusdAllowance = parseUnits("250", vusd.decimals);
  const vetBtcAllowance = parseUnits("0.25", vetBtc.decimals);

  const allowanceOnFork = (extra: string[] = []) => [
    "variable-yield",
    "allowance",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  const approveVault = async function ({
    address,
    amount,
    spender,
  }: {
    address: Address;
    amount: bigint;
    spender: Address;
  }) {
    const hash = await approve(walletClient, { address, amount, spender });
    await waitForTransactionReceipt(publicClient, { hash });
  };

  beforeAll(async function () {
    await fundTestAccount({ amount: "1000", rpcUrl });
    await approveVault({
      address: vusd.address,
      amount: vusdAllowance,
      spender: sVusdAddress,
    });
    await approveVault({
      address: vetBtc.address,
      amount: vetBtcAllowance,
      spender: sVetBtcAddress,
    });
  });

  it("reads the allowance granted to the staking vault, by symbol or address", async function () {
    const allowances: string[] = [];
    for (const token of [vusd.symbol, vusd.address]) {
      allowances.push(
        await runCli(
          allowanceOnFork(["--token", token, "--account", TEST_ADDRESS]),
        ),
      );
    }

    expect(allowances).toEqual(Array(2).fill(vusdAllowance.toString()));
  });

  it("reads the vault of the given token", async function () {
    const approved = await runCli(
      allowanceOnFork(["--token", vetBtc.symbol, "--account", TEST_ADDRESS]),
    );

    expect(approved).toBe(vetBtcAllowance.toString());
  });

  it("prints 0 for an account that never approved the vault", async function () {
    const approved = await runCli(
      allowanceOnFork(["--token", vusd.symbol, "--account", untouchedAccount]),
    );

    expect(approved).toBe("0");
  });

  it.for([usdc.symbol, sVusdAddress])(
    "rejects a token that is not pegged: %s",
    async function (token) {
      const { exitCode, stderr } = await runCliRaw(
        allowanceOnFork(["--token", token, "--account", TEST_ADDRESS]),
      );
      expect(exitCode).toBe(1);
      expect(JSON.parse(stderr).error).toBe(`Not a pegged token: "${token}"`);
    },
  );

  it("rejects an invalid --account", async function () {
    const { exitCode, stderr } = await runCliRaw(
      allowanceOnFork(["--token", vusd.symbol, "--account", "notanaddress"]),
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
      const { exitCode, stderr } = await runCliRaw(allowanceOnFork([...extra]));
      expect(exitCode).toBe(1);
      expect(stderr).toContain(message);
    },
  );
});
