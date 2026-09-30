import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { gatewayAddresses } from "@vetro-protocol/gateway";
import { getMaxWithdraw, previewRedeem } from "@vetro-protocol/gateway/actions";
import {
  type Address,
  decodeFunctionData,
  formatUnits,
  isAddress,
  isAddressEqual,
  isHex,
  numberToHex,
  parseUnits,
} from "viem";
import { getChainId } from "viem/actions";
import { describe, expect, inject, it } from "vitest";

import {
  type TransactionRequest,
  createClients,
  redeemAbi,
  redeemArgs,
  runCli,
  runCliRaw,
  setWithdrawActive,
  slippage,
  swapAmount,
  usdc,
  vusd,
} from "./helpers.ts";

describe("swap redeem", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient } = createClients(rpcUrl);

  const redeemOnFork = (extra: string[] = []) => [
    ...redeemArgs(extra),
    "--rpc-url",
    rpcUrl,
  ];

  it("targets the chain the RPC is on, with no native value", async function () {
    const request = await runCli<TransactionRequest>(redeemOnFork());
    expect(request.chainId).toBe(numberToHex(await getChainId(publicClient)));
    expect(isHex(request.data)).toBe(true);
    expect(isAddress(request.to)).toBe(true);
    expect(request.value).toBe("0x0");
  });

  it("redeems from the gateway that mints VUSD", async function () {
    const request = await runCli<TransactionRequest>(redeemOnFork());
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

  it("encodes the redeem arguments as given", async function () {
    const request = await runCli<TransactionRequest>(
      redeemOnFork(["--slippage", slippage]),
    );
    const { args } = decodeFunctionData({
      abi: redeemAbi,
      data: request.data,
    });
    const [tokenOut, peggedTokenIn, minAmountOut, receiver] = args;
    const preview = await previewRedeem(publicClient, {
      address: request.to,
      peggedTokenIn,
      tokenOut: usdc.address,
    });

    expect(isAddressEqual(tokenOut, usdc.address)).toBe(true);
    expect(peggedTokenIn).toBe(parseUnits(swapAmount, vusd.decimals));
    expect(isAddressEqual(receiver, TEST_ADDRESS)).toBe(true);
    expect(minAmountOut).toBe((preview * 995n) / 1000n);
  });

  it("requires the full preview when --slippage is omitted", async function () {
    const request = await runCli<TransactionRequest>(redeemOnFork());
    const { args } = decodeFunctionData({
      abi: redeemAbi,
      data: request.data,
    });
    const preview = await previewRedeem(publicClient, {
      address: request.to,
      peggedTokenIn: parseUnits(swapAmount, vusd.decimals),
      tokenOut: usdc.address,
    });
    expect(args[2]).toBe(preview);
  });

  it("rejects redeeming into a pegged token", async function () {
    const { exitCode, stderr } = await runCliRaw(
      redeemOnFork(["--to", vusd.symbol]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Not a whitelisted token: "${vusd.symbol}"`,
    );
  });

  it("rejects an amount with more decimals than the token supports", async function () {
    const { exitCode, stderr } = await runCliRaw(
      redeemOnFork(["--amount", "0.0000000000000000001"]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount has more decimals than "${vusd.symbol}" supports: ${vusd.decimals}`,
    );
  });

  it("rejects an amount that pays out zero", async function () {
    const { exitCode, stderr } = await runCliRaw(
      redeemOnFork(["--amount", "0.0000001"]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount is too small to redeem into "${usdc.symbol}": it pays out 0`,
    );
  });

  it("rejects an amount that pays out more than the treasury reserves", async function () {
    const [gateway] = gatewayAddresses;
    const reserves = await getMaxWithdraw(publicClient, {
      address: gateway,
      tokenOut: usdc.address,
    });
    const amount = formatUnits(reserves * 2n, usdc.decimals);
    const preview = await previewRedeem(publicClient, {
      address: gateway,
      peggedTokenIn: parseUnits(amount, vusd.decimals),
      tokenOut: usdc.address,
    });
    expect(preview).toBeGreaterThan(reserves);

    const { exitCode, stderr } = await runCliRaw(
      redeemOnFork(["--amount", amount]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toContain(
      "Amount exceeds the treasury reserves",
    );
  });

  it("rejects redeeming into a token whose withdrawals are paused", async function () {
    const [gateway] = gatewayAddresses;
    await setWithdrawActive({
      active: false,
      gateway,
      rpcUrl,
      token: usdc.address,
    });

    try {
      const { exitCode, stderr } = await runCliRaw(redeemOnFork());
      expect(exitCode).toBe(1);
      expect(JSON.parse(stderr).error).toBe(
        `Redeeming into "${usdc.symbol}" is paused`,
      );
    } finally {
      await setWithdrawActive({
        active: true,
        gateway,
        rpcUrl,
        token: usdc.address,
      });
    }
  });

  it.for([
    ["--amount", "0"],
    ["--amount", "abc"],
    ["--amount", "-1"],
    ["--slippage", "101"],
    ["--slippage", "0.25"],
    ["--receiver", "notanaddress"],
  ])("rejects %s %s as a usage error", async function ([flag, value]) {
    const { exitCode, stderr } = await runCliRaw(redeemOnFork([flag, value]));
    expect(exitCode).toBe(1);
    expect(stderr).toContain(`option '${flag}`);
  });

  it("rejects a missing --receiver", async function () {
    const { exitCode, stderr } = await runCliRaw([
      "swap",
      "redeem",
      "--to",
      usdc.symbol,
      "--amount",
      swapAmount,
      "--rpc-url",
      rpcUrl,
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("required option '--receiver <addr>'");
  });
});
