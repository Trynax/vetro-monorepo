import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { sVusdAddress } from "@vetro-protocol/core";
import { stakingVaultAbi } from "@vetro-protocol/earn";
import { type Address, type Hex, parseEventLogs, parseUnits } from "viem";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import {
  increaseTime,
  mine,
  revert,
  snapshot,
  waitForTransactionReceipt,
  writeContract,
} from "viem/actions";
import { symbol } from "viem-erc20/actions";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  createClients,
  fundTestAccount,
  runCli,
  runCliRaw,
  setStakingCooldown,
  stake,
  usdc,
  vusd,
} from "./helpers.ts";

type ExitTicket = {
  assets: string;
  claimableAt: string | null;
  requestId: string;
  status: "cooldown" | "ready";
};

type WithdrawRequest = {
  assets: bigint;
  claimableAt: bigint;
  requestId: bigint;
};

const untouchedAccount = privateKeyToAddress(generatePrivateKey());

const cooldownTicket = ({
  assets,
  claimableAt,
  requestId,
}: WithdrawRequest) => ({
  assets: assets.toString(),
  claimableAt: claimableAt.toString(),
  requestId: requestId.toString(),
  status: "cooldown",
});

const readyTicket = ({ assets, requestId }: WithdrawRequest) => ({
  assets: assets.toString(),
  claimableAt: null,
  requestId: requestId.toString(),
  status: "ready",
});

describe("variable-yield exit-tickets", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient, testClient, walletClient } = createClients(rpcUrl);
  const cooldownDuration = 86_400n;

  const exitTicketsOnFork = (extra: string[] = []) => [
    "variable-yield",
    "exit-tickets",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  const fastForward = async function (seconds: bigint) {
    await increaseTime(testClient, { seconds: Number(seconds) });
    await mine(testClient, { blocks: 1 });
  };

  const withSnapshot = async function (run: () => Promise<void>) {
    const id = await snapshot(testClient);
    try {
      await run();
    } finally {
      await revert(testClient, { id });
    }
  };

  const requestWithdraw = async function ({
    assets,
    vault,
  }: {
    assets: bigint;
    vault: Address;
  }) {
    await fastForward(60n);
    const hash = await writeContract(walletClient, {
      abi: stakingVaultAbi,
      address: vault,
      args: [assets, TEST_ADDRESS],
      functionName: "requestWithdraw",
    });
    const { logs, status } = await waitForTransactionReceipt(publicClient, {
      hash,
    });
    expect(status).toBe("success");
    const [{ args }] = parseEventLogs({
      abi: stakingVaultAbi,
      eventName: "WithdrawRequested",
      logs,
    });
    return args;
  };

  const cancelWithdraw = async function ({
    requestId,
    vault,
  }: {
    requestId: bigint;
    vault: Address;
  }) {
    await fastForward(60n);
    const hash = await writeContract(walletClient, {
      abi: stakingVaultAbi,
      address: vault,
      args: [requestId],
      functionName: "cancelWithdraw",
    });
    const { status } = await waitForTransactionReceipt(publicClient, { hash });
    expect(status).toBe("success");
  };

  let snapshotId: Hex;

  beforeAll(async function () {
    snapshotId = await snapshot(testClient);
    await setStakingCooldown({
      duration: cooldownDuration,
      enabled: true,
      rpcUrl,
      vault: sVusdAddress,
    });
    await fundTestAccount({ amount: "1000", rpcUrl, token: vusd });
    await stake({
      amount: parseUnits("250", vusd.decimals),
      rpcUrl,
      token: vusd.address,
      vault: sVusdAddress,
    });
  });

  afterAll(() => revert(testClient, { id: snapshotId }));

  it("prints no ticket for an account that never unstaked", async function () {
    const tickets = await runCli<ExitTicket[]>(
      exitTicketsOnFork([
        "--token",
        vusd.symbol,
        "--account",
        untouchedAccount,
      ]),
    );

    expect(tickets).toEqual([]);
  });

  it("prints ready tickets and tickets in cooldown by requestId, by pegged or share token, by symbol or address", async function () {
    await withSnapshot(async function () {
      const ready = await requestWithdraw({
        assets: parseUnits("10", vusd.decimals),
        vault: sVusdAddress,
      });
      await fastForward(cooldownDuration);
      const pending = await requestWithdraw({
        assets: parseUnits("20", vusd.decimals),
        vault: sVusdAddress,
      });
      const shareSymbol = await symbol(publicClient, { address: sVusdAddress });

      const results: ExitTicket[][] = [];
      for (const token of [
        vusd.symbol,
        vusd.address,
        shareSymbol,
        sVusdAddress,
      ]) {
        results.push(
          await runCli<ExitTicket[]>(
            exitTicketsOnFork(["--token", token, "--account", TEST_ADDRESS]),
          ),
        );
      }

      expect(results).toEqual(
        Array(4).fill([readyTicket(ready), cooldownTicket(pending)]),
      );
    });
  });

  it("skips a cancelled ticket and keeps the others by requestId", async function () {
    await withSnapshot(async function () {
      const cancelled = await requestWithdraw({
        assets: parseUnits("10", vusd.decimals),
        vault: sVusdAddress,
      });
      const second = await requestWithdraw({
        assets: parseUnits("20", vusd.decimals),
        vault: sVusdAddress,
      });
      const third = await requestWithdraw({
        assets: parseUnits("30", vusd.decimals),
        vault: sVusdAddress,
      });
      await cancelWithdraw({
        requestId: cancelled.requestId,
        vault: sVusdAddress,
      });

      const tickets = await runCli<ExitTicket[]>(
        exitTicketsOnFork(["--token", vusd.symbol, "--account", TEST_ADDRESS]),
      );

      expect(tickets).toEqual([cooldownTicket(second), cooldownTicket(third)]);
    });
  });

  it("rejects a token that is not pegged or share", async function () {
    const { exitCode, stderr } = await runCliRaw(
      exitTicketsOnFork(["--token", usdc.symbol, "--account", TEST_ADDRESS]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a pegged or share token: "${usdc.symbol}"`,
    );
  });

  it("rejects an invalid --account", async function () {
    const { exitCode, stderr } = await runCliRaw(
      exitTicketsOnFork(["--token", vusd.symbol, "--account", "notanaddress"]),
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
      const { exitCode, stderr } = await runCliRaw(
        exitTicketsOnFork([...extra]),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain(message);
    },
  );
});
