import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { sVetBtcAddress, sVusdAddress } from "@vetro-protocol/core";
import { stakingVaultAbi } from "@vetro-protocol/earn";
import { getRequestDetails } from "@vetro-protocol/earn/actions";
import {
  type Address,
  type Hex,
  decodeFunctionData,
  formatUnits,
  isAddressEqual,
  numberToHex,
  parseEventLogs,
  parseUnits,
} from "viem";
import {
  getBlock,
  getChainId,
  increaseTime,
  mine,
  revert,
  setNextBlockTimestamp,
  snapshot,
} from "viem/actions";
import { balanceOf, decimals, symbol } from "viem-erc20/actions";
import { previewRedeem, previewWithdraw } from "viem-erc4626/actions";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  type TransactionRequest,
  createClients,
  fundTestAccount,
  runCli,
  runCliRaw,
  sendTransactionRequest,
  setStakingCooldown,
  stake,
  usdc,
  vetBtc,
  vusd,
} from "./helpers.ts";

describe("variable-yield unstake", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient, testClient } = createClients(rpcUrl);
  const cooldownDuration = 86_400n;
  const vaults = [sVusdAddress, sVetBtcAddress];
  const amount = "10";

  let shareDecimals: number;
  let shareSymbol: string;
  let snapshotId: Hex;

  const unstakeOnFork = (extra: string[] = []) => [
    "variable-yield",
    "unstake",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  const unstakeVusd = (extra: string[] = []) =>
    unstakeOnFork([
      "--token",
      vusd.symbol,
      "--account",
      TEST_ADDRESS,
      ...extra,
    ]);

  const decodeRequest = function (request: TransactionRequest) {
    const { args, functionName } = decodeFunctionData({
      abi: stakingVaultAbi,
      data: request.data,
    });
    const [value, owner] = args as [bigint, Address];
    return { functionName, owner, value };
  };

  const readShares = () =>
    balanceOf(publicClient, { account: TEST_ADDRESS, address: sVusdAddress });

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

  const broadcast = async function (args: string[]) {
    await fastForward(60n);
    const [previewedAssets, previewedShares] = await Promise.all([
      previewRedeem(publicClient, {
        address: sVusdAddress,
        shares: parseUnits(amount, shareDecimals),
      }),
      previewWithdraw(publicClient, {
        address: sVusdAddress,
        assets: parseUnits(amount, vusd.decimals),
      }),
    ]);
    const latest = await getBlock(publicClient);
    await setNextBlockTimestamp(testClient, { timestamp: latest.timestamp });
    const request = await runCli<TransactionRequest>(args);
    const receipt = await sendTransactionRequest({ request, rpcUrl });
    expect(receipt.status).toBe("success");
    const [{ args: event }] = parseEventLogs({
      abi: stakingVaultAbi,
      eventName: "WithdrawRequested",
      logs: receipt.logs,
    });
    const { timestamp } = await getBlock(publicClient, {
      blockNumber: receipt.blockNumber,
    });
    return { event, previewedAssets, previewedShares, timestamp };
  };

  beforeAll(async function () {
    snapshotId = await snapshot(testClient);
    [shareDecimals, shareSymbol] = await Promise.all([
      decimals(publicClient, { address: sVusdAddress }),
      symbol(publicClient, { address: sVusdAddress }),
    ]);
    for (const vault of vaults) {
      await setStakingCooldown({
        duration: cooldownDuration,
        enabled: true,
        rpcUrl,
        vault,
      });
    }
    await fundTestAccount({ amount: "1000", rpcUrl, token: vusd });
    await fundTestAccount({ amount: "1", rpcUrl, token: vetBtc });
    await stake({
      amount: parseUnits("250", vusd.decimals),
      rpcUrl,
      token: vusd.address,
      vault: sVusdAddress,
    });
    await stake({
      amount: parseUnits("0.25", vetBtc.decimals),
      rpcUrl,
      token: vetBtc.address,
      vault: sVetBtcAddress,
    });
  });

  afterAll(() => revert(testClient, { id: snapshotId }));

  it("targets the vault on the chain the RPC is on, with no native value", async function () {
    const request = await runCli<TransactionRequest>(
      unstakeVusd(["--amount", amount]),
    );
    expect(request.chainId).toBe(numberToHex(await getChainId(publicClient)));
    expect(isAddressEqual(request.to, sVusdAddress)).toBe(true);
    expect(request.value).toBe("0x0");
  });

  it("encodes requestWithdraw(assets, owner) in the pegged token's decimals", async function () {
    const request = await runCli<TransactionRequest>(
      unstakeVusd(["--amount", amount]),
    );
    const { functionName, owner, value } = decodeRequest(request);
    expect(functionName).toBe("requestWithdraw");
    expect(value).toBe(parseUnits(amount, vusd.decimals));
    expect(isAddressEqual(owner, TEST_ADDRESS)).toBe(true);
  });

  it("encodes requestRedeem(shares, owner) in the share token's decimals", async function () {
    const request = await runCli<TransactionRequest>(
      unstakeVusd(["--shares", amount]),
    );
    const { functionName, owner, value } = decodeRequest(request);
    expect(functionName).toBe("requestRedeem");
    expect(value).toBe(parseUnits(amount, shareDecimals));
    expect(isAddressEqual(owner, TEST_ADDRESS)).toBe(true);
  });

  it("encodes the same request by pegged or share token, by symbol or address", async function () {
    const requests: TransactionRequest[] = [];
    for (const token of [
      vusd.symbol,
      vusd.address,
      shareSymbol,
      sVusdAddress,
    ]) {
      requests.push(
        await runCli<TransactionRequest>(
          unstakeOnFork([
            "--token",
            token,
            "--amount",
            amount,
            "--account",
            TEST_ADDRESS,
          ]),
        ),
      );
    }

    expect(requests).toEqual(Array(4).fill(requests[0]));
  });

  it("targets the vault of the given token", async function () {
    const request = await runCli<TransactionRequest>(
      unstakeOnFork([
        "--token",
        vetBtc.symbol,
        "--amount",
        "0.01",
        "--account",
        TEST_ADDRESS,
      ]),
    );
    expect(isAddressEqual(request.to, sVetBtcAddress)).toBe(true);
    const { functionName, value } = decodeRequest(request);
    expect(functionName).toBe("requestWithdraw");
    expect(value).toBe(parseUnits("0.01", vetBtc.decimals));
  });

  it("opens an exit ticket for the amount once the calldata is broadcast", async function () {
    await withSnapshot(async function () {
      const sharesBefore = await readShares();

      const { event, previewedShares, timestamp } = await broadcast(
        unstakeVusd(["--amount", amount]),
      );

      const ticket = await getRequestDetails(publicClient, {
        address: sVusdAddress,
        requestId: event.requestId,
      });
      expect(isAddressEqual(ticket.owner, TEST_ADDRESS)).toBe(true);
      expect(ticket.assets).toBe(parseUnits(amount, vusd.decimals));
      expect(ticket.claimableAt).toBe(timestamp + cooldownDuration);
      expect(event.shares).toBe(previewedShares);
      expect(sharesBefore - (await readShares())).toBe(event.shares);
    });
  });

  it("burns exactly the shares once the calldata is broadcast", async function () {
    await withSnapshot(async function () {
      const shares = parseUnits(amount, shareDecimals);
      const sharesBefore = await readShares();

      const { event, previewedAssets, timestamp } = await broadcast(
        unstakeVusd(["--shares", amount]),
      );

      expect(sharesBefore - (await readShares())).toBe(shares);
      expect(event.shares).toBe(shares);
      const ticket = await getRequestDetails(publicClient, {
        address: sVusdAddress,
        requestId: event.requestId,
      });
      expect(isAddressEqual(ticket.owner, TEST_ADDRESS)).toBe(true);
      expect(ticket.assets).toBe(event.assets);
      expect(ticket.assets).toBe(previewedAssets);
      expect(ticket.claimableAt).toBe(timestamp + cooldownDuration);
    });
  });

  it("unstakes the whole balance with no dust when given all the shares", async function () {
    await withSnapshot(async function () {
      const sharesBefore = await readShares();
      expect(sharesBefore).toBeGreaterThan(0n);

      const { event } = await broadcast(
        unstakeVusd(["--shares", formatUnits(sharesBefore, shareDecimals)]),
      );

      expect(event.shares).toBe(sharesBefore);
      expect(await readShares()).toBe(0n);
    });
  });

  it("rejects the unstake when the cooldown is disabled", async function () {
    await setStakingCooldown({ enabled: false, rpcUrl, vault: sVusdAddress });
    try {
      const { exitCode, stderr } = await runCliRaw(
        unstakeVusd(["--amount", amount]),
      );
      expect(exitCode).toBe(1);
      expect(JSON.parse(stderr).error).toBe(
        `The cooldown is disabled: the vault takes a one-step withdraw for "${vusd.symbol}", which the CLI does not encode yet`,
      );
    } finally {
      await setStakingCooldown({ enabled: true, rpcUrl, vault: sVusdAddress });
    }
  });

  it("rejects --amount and --shares together", async function () {
    const { exitCode, stderr } = await runCliRaw(
      unstakeVusd(["--amount", amount, "--shares", amount]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain(
      "option '--amount <n>' cannot be used with option '--shares <n>'",
    );
  });

  it("rejects a request with neither --amount nor --shares", async function () {
    const { exitCode, stderr } = await runCliRaw(unstakeVusd());
    expect(exitCode).toBe(1);
    expect(stderr).toContain(
      "one of '--amount <n>' or '--shares <n>' is required",
    );
  });

  it("rejects a token that is not pegged or share", async function () {
    const { exitCode, stderr } = await runCliRaw(
      unstakeOnFork([
        "--token",
        usdc.symbol,
        "--amount",
        amount,
        "--account",
        TEST_ADDRESS,
      ]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a pegged or share token: "${usdc.symbol}"`,
    );
  });

  it("rejects an amount with more decimals than the pegged token supports", async function () {
    const { exitCode, stderr } = await runCliRaw(
      unstakeVusd(["--amount", "0.0000000000000000001"]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount has more decimals than "${vusd.symbol}" supports: ${vusd.decimals}`,
    );
  });

  it("rejects shares with more decimals than the share token supports", async function () {
    const { exitCode, stderr } = await runCliRaw(
      unstakeVusd(["--shares", `0.${"0".repeat(shareDecimals)}1`]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount has more decimals than "${shareSymbol}" supports: ${shareDecimals}`,
    );
  });

  it.for([
    ["--amount", "0"],
    ["--amount", "abc"],
    ["--amount", "-1"],
    ["--shares", "0"],
    ["--shares", "abc"],
    ["--shares", "-1"],
  ])("rejects %s %s as a usage error", async function ([flag, value]) {
    const { exitCode, stderr } = await runCliRaw(unstakeVusd([flag, value]));
    expect(exitCode).toBe(1);
    expect(stderr).toContain(`option '${flag}`);
  });

  it("rejects an invalid --account", async function () {
    const { exitCode, stderr } = await runCliRaw(
      unstakeOnFork([
        "--token",
        vusd.symbol,
        "--amount",
        amount,
        "--account",
        "notanaddress",
      ]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid address: "notanaddress"');
  });

  it.for([
    [
      ["--amount", amount, "--account", TEST_ADDRESS],
      "required option '--token <token>'",
    ],
    [
      ["--token", vusd.symbol, "--amount", amount],
      "required option '--account <addr>'",
    ],
  ] as const)(
    "rejects a missing option: %s",
    async function ([extra, message]) {
      const { exitCode, stderr } = await runCliRaw(unstakeOnFork([...extra]));
      expect(exitCode).toBe(1);
      expect(stderr).toContain(message);
    },
  );
});
