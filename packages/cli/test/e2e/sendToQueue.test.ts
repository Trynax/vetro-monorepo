import { gatewayAddresses } from "@vetro-protocol/gateway";
import {
  type Address,
  decodeFunctionData,
  isAddress,
  isAddressEqual,
  isHex,
  numberToHex,
  parseUnits,
} from "viem";
import { getChainId } from "viem/actions";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  type TransactionRequest,
  createClients,
  requestRedeemAbi,
  runCli,
  runCliRaw,
  sendToQueueArgs,
  setRedeemQueueEnabled,
  swapAmount,
  usdc,
  vusd,
} from "./helpers.ts";

describe("swap send-to-queue", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient } = createClients(rpcUrl);
  const [gateway] = gatewayAddresses;

  const sendToQueueOnFork = (extra: string[] = []) => [
    ...sendToQueueArgs(extra),
    "--rpc-url",
    rpcUrl,
  ];

  let restoreQueue: (() => Promise<void>) | undefined;

  beforeAll(async function () {
    restoreQueue = await setRedeemQueueEnabled({
      enabled: true,
      gateway,
      rpcUrl,
    });
  });

  afterAll(() => restoreQueue?.());

  it("targets the chain the RPC is on, with no native value", async function () {
    const request = await runCli<TransactionRequest>(sendToQueueOnFork());
    expect(request.chainId).toBe(numberToHex(await getChainId(publicClient)));
    expect(isHex(request.data)).toBe(true);
    expect(isAddress(request.to)).toBe(true);
    expect(request.value).toBe("0x0");
  });

  it("requests the redeem from the gateway that mints VUSD", async function () {
    const request = await runCli<TransactionRequest>(sendToQueueOnFork());
    const peggedToken = await runCli<Address>([
      "swap",
      "pegged-token",
      "--gateway",
      request.to,
      "--rpc-url",
      rpcUrl,
    ]);
    expect(isAddressEqual(peggedToken, vusd.address)).toBe(true);
  });

  it("encodes the amount in the pegged token's decimals", async function () {
    const request = await runCli<TransactionRequest>(sendToQueueOnFork());
    const { args } = decodeFunctionData({
      abi: requestRedeemAbi,
      data: request.data,
    });
    expect(args[0]).toBe(parseUnits(swapAmount, vusd.decimals));
  });

  it("rejects sending a whitelisted token to the queue", async function () {
    const { exitCode, stderr } = await runCliRaw(
      sendToQueueOnFork(["--from", usdc.symbol]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a pegged token: "${usdc.symbol}"`,
    );
  });

  it("rejects an amount with more decimals than the token supports", async function () {
    const { exitCode, stderr } = await runCliRaw(
      sendToQueueOnFork(["--amount", "0.0000000000000000001"]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount has more decimals than "${vusd.symbol}" supports: ${vusd.decimals}`,
    );
  });

  it("rejects sending to the queue when the queue is disabled", async function () {
    const restore = await setRedeemQueueEnabled({
      enabled: false,
      gateway,
      rpcUrl,
    });

    try {
      const { exitCode, stderr } = await runCliRaw(sendToQueueOnFork());
      expect(exitCode).toBe(1);
      expect(JSON.parse(stderr).error).toBe(
        `The redeem queue is disabled: redeem "${vusd.symbol}" in one step instead`,
      );
    } finally {
      await restore();
    }
  });

  it.for(["0", "abc", "-1"])(
    "rejects --amount %s as a usage error",
    async function (value) {
      const { exitCode, stderr } = await runCliRaw(
        sendToQueueOnFork(["--amount", value]),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("option '--amount");
    },
  );

  it("rejects a missing --from", async function () {
    const { exitCode, stderr } = await runCliRaw([
      "swap",
      "send-to-queue",
      "--amount",
      swapAmount,
      "--rpc-url",
      rpcUrl,
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("required option '--from <token>'");
  });
});
