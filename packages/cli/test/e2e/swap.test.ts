import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { gatewayAddresses } from "@vetro-protocol/gateway";
import {
  getRedeemRequest,
  getWithdrawalDelay,
} from "@vetro-protocol/gateway/actions";
import { decodeFunctionData, isAddressEqual, parseUnits } from "viem";
import { getBlock, increaseTime, mine, revert, snapshot } from "viem/actions";
import { balanceOf } from "viem-erc20/actions";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  type RedeemRequest,
  type TransactionRequest,
  approveArgs,
  cancelRedeemArgs,
  createClients,
  depositAbi,
  fundTestAccount,
  mintArgs,
  redeemAbi,
  redeemArgs,
  requestArgs,
  runCli,
  sendToQueueArgs,
  sendTransactionRequest,
  setRedeemQueueEnabled,
  slippage,
  usdc,
  vusd,
} from "./helpers.ts";

const rpcUrl = inject("anvilUrl");
const { publicClient, testClient } = createClients(rpcUrl);

const onFork = (args: string[]) => [...args, "--rpc-url", rpcUrl];

const readBalances = () =>
  Promise.all([
    balanceOf(publicClient, { account: TEST_ADDRESS, address: usdc.address }),
    balanceOf(publicClient, { account: TEST_ADDRESS, address: vusd.address }),
  ]);

const readVusdBalance = () =>
  balanceOf(publicClient, { account: TEST_ADDRESS, address: vusd.address });

const broadcast = async function (args: string[]) {
  const receipt = await sendTransactionRequest({
    request: await runCli<TransactionRequest>(onFork(args)),
    rpcUrl,
  });
  expect(receipt.status).toBe("success");
  return receipt;
};

// Spans approve and mint, so it lives here rather than in either command's file.
describe("swap in (USDC → VUSD)", function () {
  it("mints at least minPeggedTokenOut once the mint calldata is broadcast", async function () {
    const mintRequest = await runCli<TransactionRequest>(
      onFork(mintArgs(["--slippage", slippage])),
    );
    await fundTestAccount({ amount: "1000", rpcUrl });
    // Approving sets the allowance, so this is safe however often it runs.
    await broadcast(approveArgs(usdc.symbol));

    const { args } = decodeFunctionData({
      abi: depositAbi,
      data: mintRequest.data,
    });
    const balanceBefore = await balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    });

    const receipt = await sendTransactionRequest({
      request: mintRequest,
      rpcUrl,
    });
    expect(receipt.status).toBe("success");

    const balanceAfter = await balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    });
    expect(balanceAfter - balanceBefore).toBeGreaterThanOrEqual(args[2]);
  });
});

describe("swap out in two steps (VUSD → queue → USDC) and swap request", function () {
  const [gateway] = gatewayAddresses;

  const queuedAmount = "50";

  const accountArgs = ["--account", TEST_ADDRESS, "--gateway", gateway];

  const requestOnFork = () => onFork(requestArgs(accountArgs));

  let restoreQueue: (() => Promise<void>) | undefined;

  beforeAll(async function () {
    restoreQueue = await setRedeemQueueEnabled({
      enabled: true,
      gateway,
      rpcUrl,
    });
  });

  afterAll(() => restoreQueue?.());

  it("locks the pegged token once the send-to-queue calldata is broadcast", async function () {
    await fundTestAccount({ amount: "1000", rpcUrl });
    await broadcast(approveArgs(usdc.symbol));
    await broadcast(mintArgs());
    await broadcast(approveArgs(vusd.symbol));

    const [amountLockedBefore] = await getRedeemRequest(publicClient, {
      address: gateway,
      user: TEST_ADDRESS,
    });

    const receipt = await broadcast(
      sendToQueueArgs(["--amount", queuedAmount]),
    );

    const [[amountLockedAfter, claimableAt], block, delay] = await Promise.all([
      getRedeemRequest(publicClient, { address: gateway, user: TEST_ADDRESS }),
      getBlock(publicClient, { blockNumber: receipt.blockNumber }),
      getWithdrawalDelay(publicClient, { address: gateway }),
    ]);
    expect(amountLockedAfter - amountLockedBefore).toBe(
      parseUnits(queuedAmount, vusd.decimals),
    );
    expect(claimableAt).toBe(block.timestamp + delay);
  });

  it("reports the queued request in cooldown", async function () {
    const [[amountLocked, claimableAt], request] = await Promise.all([
      getRedeemRequest(publicClient, { address: gateway, user: TEST_ADDRESS }),
      runCli<RedeemRequest>(requestOnFork()),
    ]);

    expect(request).toEqual({
      amountLocked: amountLocked.toString(),
      claimableAt: claimableAt.toString(),
      status: "cooldown",
    });
  });

  it("reports the queued request as ready once the cooldown ends", async function () {
    const id = await snapshot(testClient);
    try {
      const delay = await getWithdrawalDelay(publicClient, {
        address: gateway,
      });
      await increaseTime(testClient, { seconds: Number(delay) });
      await mine(testClient, { blocks: 1 });

      const request = await runCli<RedeemRequest>(requestOnFork());

      expect(request.status).toBe("ready");
    } finally {
      await revert(testClient, { id });
    }
  });

  it("returns the locked amount to the wallet once the cancel-redeem calldata is broadcast", async function () {
    const id = await snapshot(testClient);
    try {
      const [cancelRequest, [amountLocked], vusdBefore] = await Promise.all([
        runCli<TransactionRequest>(onFork(cancelRedeemArgs(accountArgs))),
        getRedeemRequest(publicClient, {
          address: gateway,
          user: TEST_ADDRESS,
        }),
        readVusdBalance(),
      ]);
      expect(isAddressEqual(cancelRequest.to, gateway)).toBe(true);

      const receipt = await sendTransactionRequest({
        request: cancelRequest,
        rpcUrl,
      });
      expect(receipt.status).toBe("success");

      const [request, vusdAfter] = await Promise.all([
        runCli<RedeemRequest>(requestOnFork()),
        readVusdBalance(),
      ]);
      expect(request.status).toBe("none");
      expect(vusdAfter - vusdBefore).toBe(amountLocked);
    } finally {
      await revert(testClient, { id });
    }
  });

  it("pays out at least minAmountOut from the locked amount once the redeem calldata is broadcast after the cooldown", async function () {
    const id = await snapshot(testClient);
    try {
      const delay = await getWithdrawalDelay(publicClient, {
        address: gateway,
      });
      await increaseTime(testClient, { seconds: Number(delay) });
      await mine(testClient, { blocks: 1 });

      const redeemRequest = await runCli<TransactionRequest>(
        onFork(redeemArgs(["--amount", queuedAmount, "--slippage", slippage])),
      );
      const { args } = decodeFunctionData({
        abi: redeemAbi,
        data: redeemRequest.data,
      });
      const [[amountLockedBefore], [usdcBefore, vusdBefore]] =
        await Promise.all([
          getRedeemRequest(publicClient, {
            address: gateway,
            user: TEST_ADDRESS,
          }),
          readBalances(),
        ]);

      const receipt = await sendTransactionRequest({
        request: redeemRequest,
        rpcUrl,
      });
      expect(receipt.status).toBe("success");

      const [[amountLockedAfter], [usdcAfter, vusdAfter]] = await Promise.all([
        getRedeemRequest(publicClient, {
          address: gateway,
          user: TEST_ADDRESS,
        }),
        readBalances(),
      ]);
      expect(amountLockedBefore - amountLockedAfter).toBe(
        parseUnits(queuedAmount, vusd.decimals),
      );
      expect(usdcAfter - usdcBefore).toBeGreaterThanOrEqual(args[2]);
      expect(vusdAfter).toBe(vusdBefore);
    } finally {
      await revert(testClient, { id });
    }
  });
});

describe("swap out in one step (VUSD → USDC)", function () {
  const [gateway] = gatewayAddresses;

  let restoreQueue: (() => Promise<void>) | undefined;

  beforeAll(async function () {
    restoreQueue = await setRedeemQueueEnabled({
      enabled: false,
      gateway,
      rpcUrl,
    });
  });

  afterAll(() => restoreQueue?.());

  it("burns the pegged token from the wallet once the redeem calldata is broadcast", async function () {
    await fundTestAccount({ amount: "1000", rpcUrl });
    await broadcast(approveArgs(usdc.symbol));
    await broadcast(mintArgs());
    await broadcast(approveArgs(vusd.symbol));

    const redeemRequest = await runCli<TransactionRequest>(
      onFork(redeemArgs(["--slippage", slippage])),
    );
    const { args } = decodeFunctionData({
      abi: redeemAbi,
      data: redeemRequest.data,
    });
    const [usdcBefore, vusdBefore] = await readBalances();

    const receipt = await sendTransactionRequest({
      request: redeemRequest,
      rpcUrl,
    });
    expect(receipt.status).toBe("success");

    const [usdcAfter, vusdAfter] = await readBalances();
    expect(vusdBefore - vusdAfter).toBe(args[1]);
    expect(usdcAfter - usdcBefore).toBeGreaterThanOrEqual(args[2]);
  });
});
