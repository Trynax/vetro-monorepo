import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { isAddressEqual, parseUnits } from "viem";
import { describe, expect, inject, it } from "vitest";

import {
  type TransactionRequest,
  swapAmount,
  approveArgs,
  fundTestAccount,
  runCli,
  runCliRaw,
  sendTransactionRequest,
  usdc,
  vusd,
} from "./helpers.ts";

describe("swap approve", function () {
  const rpcUrl = inject("anvilUrl");

  const approveOnFork = ({
    extra = [],
    token,
  }: {
    extra?: string[];
    token: string;
  }) => [...approveArgs({ extra, token }), "--rpc-url", rpcUrl];

  const readAllowance = (token: string) =>
    runCli([
      "swap",
      "allowance",
      "--token",
      token,
      "--account",
      TEST_ADDRESS,
      "--rpc-url",
      rpcUrl,
    ]);

  it("grants the gateway a USDC allowance once the approve calldata is broadcast", async function () {
    await fundTestAccount({ amount: "1000", rpcUrl });
    const request = await runCli<TransactionRequest>(
      approveOnFork({ token: usdc.symbol }),
    );
    expect(isAddressEqual(request.to, usdc.address)).toBe(true);

    const receipt = await sendTransactionRequest({ request, rpcUrl });
    expect(receipt.status).toBe("success");

    expect(await readAllowance(usdc.symbol)).toBe(
      parseUnits(swapAmount, usdc.decimals).toString(),
    );
  });

  it("grants the gateway an allowance on the pegged token", async function () {
    await fundTestAccount({ amount: "1000", rpcUrl });
    const request = await runCli<TransactionRequest>(
      approveOnFork({ token: vusd.symbol }),
    );
    expect(isAddressEqual(request.to, vusd.address)).toBe(true);

    const receipt = await sendTransactionRequest({ request, rpcUrl });
    expect(receipt.status).toBe("success");

    expect(await readAllowance(vusd.symbol)).toBe(
      parseUnits(swapAmount, vusd.decimals).toString(),
    );
  });

  it("resolves a token given a non-checksummed address", async function () {
    const request = await runCli<TransactionRequest>(
      approveOnFork({ token: usdc.address.toLowerCase() }),
    );
    expect(isAddressEqual(request.to, usdc.address)).toBe(true);
  });

  it("rejects a token the protocol does not know", async function () {
    const { exitCode, stderr } = await runCliRaw(
      approveOnFork({ token: "USDX" }),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      'Not a whitelisted or pegged token: "USDX"',
    );
  });

  it("rejects an amount with more decimals than the token supports", async function () {
    const { exitCode, stderr } = await runCliRaw(
      approveOnFork({ extra: ["--amount", "0.0000001"], token: usdc.symbol }),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount has more decimals than "${usdc.symbol}" supports: ${usdc.decimals}`,
    );
  });

  it("resets the allowance to 0", async function () {
    await fundTestAccount({ amount: "1000", rpcUrl });
    await sendTransactionRequest({
      request: await runCli<TransactionRequest>(
        approveOnFork({ token: usdc.symbol }),
      ),
      rpcUrl,
    });

    const request = await runCli<TransactionRequest>(
      approveOnFork({ extra: ["--amount", "0"], token: usdc.symbol }),
    );
    const receipt = await sendTransactionRequest({ request, rpcUrl });
    expect(receipt.status).toBe("success");

    expect(await readAllowance(usdc.symbol)).toBe("0");
  });
});
