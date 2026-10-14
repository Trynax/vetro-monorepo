import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { sVetBtcAddress, sVusdAddress } from "@vetro-protocol/core";
import {
  type Address,
  decodeFunctionData,
  erc20Abi,
  isAddressEqual,
  numberToHex,
  parseUnits,
} from "viem";
import { getChainId } from "viem/actions";
import { allowance } from "viem-erc20/actions";
import { beforeAll, describe, expect, inject, it } from "vitest";

import {
  type TransactionRequest,
  createClients,
  fundTestAccount,
  runCli,
  runCliRaw,
  sendTransactionRequest,
  swapAmount,
  usdc,
  vetBtc,
  vusd,
} from "./helpers.ts";

describe("variable-yield approve", function () {
  const rpcUrl = inject("anvilUrl");
  const { publicClient } = createClients(rpcUrl);

  const approveOnFork = (extra: string[] = []) => [
    "variable-yield",
    "approve",
    ...extra,
    "--rpc-url",
    rpcUrl,
  ];

  const decodeApprove = function (request: TransactionRequest) {
    const { args, functionName } = decodeFunctionData({
      abi: erc20Abi,
      data: request.data,
    });
    expect(functionName).toBe("approve");
    const [spender, amount] = args as [Address, bigint];
    return { amount, spender };
  };

  const readVusdAllowance = () =>
    allowance(publicClient, {
      address: vusd.address,
      owner: TEST_ADDRESS,
      spender: sVusdAddress,
    });

  beforeAll(() => fundTestAccount({ amount: "1000", rpcUrl, token: vusd }));

  it("targets the pegged token on the chain the RPC is on, with no native value", async function () {
    const request = await runCli<TransactionRequest>(
      approveOnFork(["--token", vusd.symbol, "--amount", swapAmount]),
    );
    expect(request.chainId).toBe(numberToHex(await getChainId(publicClient)));
    expect(isAddressEqual(request.to, vusd.address)).toBe(true);
    expect(request.value).toBe("0x0");
  });

  it("encodes approve(vault, amount) in the pegged token's decimals", async function () {
    const request = await runCli<TransactionRequest>(
      approveOnFork(["--token", vusd.symbol, "--amount", swapAmount]),
    );
    const { amount, spender } = decodeApprove(request);
    expect(isAddressEqual(spender, sVusdAddress)).toBe(true);
    expect(amount).toBe(parseUnits(swapAmount, vusd.decimals));
  });

  it("encodes the same request by address as by symbol", async function () {
    const bySymbol = await runCli<TransactionRequest>(
      approveOnFork(["--token", vusd.symbol, "--amount", swapAmount]),
    );
    const byAddress = await runCli<TransactionRequest>(
      approveOnFork(["--token", vusd.address, "--amount", swapAmount]),
    );
    expect(byAddress).toEqual(bySymbol);
  });

  it("approves the vault of the given token", async function () {
    const request = await runCli<TransactionRequest>(
      approveOnFork(["--token", vetBtc.symbol, "--amount", "0.25"]),
    );
    expect(isAddressEqual(request.to, vetBtc.address)).toBe(true);
    const { amount, spender } = decodeApprove(request);
    expect(isAddressEqual(spender, sVetBtcAddress)).toBe(true);
    expect(amount).toBe(parseUnits("0.25", vetBtc.decimals));
  });

  it("grants the vault an allowance once the calldata is broadcast", async function () {
    const request = await runCli<TransactionRequest>(
      approveOnFork(["--token", vusd.symbol, "--amount", swapAmount]),
    );
    const receipt = await sendTransactionRequest({ request, rpcUrl });
    expect(receipt.status).toBe("success");

    expect(await readVusdAllowance()).toBe(
      parseUnits(swapAmount, vusd.decimals),
    );
  });

  it("resets the allowance to 0", async function () {
    await sendTransactionRequest({
      request: await runCli<TransactionRequest>(
        approveOnFork(["--token", vusd.symbol, "--amount", swapAmount]),
      ),
      rpcUrl,
    });

    const request = await runCli<TransactionRequest>(
      approveOnFork(["--token", vusd.symbol, "--amount", "0"]),
    );
    const receipt = await sendTransactionRequest({ request, rpcUrl });
    expect(receipt.status).toBe("success");

    expect(await readVusdAllowance()).toBe(0n);
  });

  it.for([usdc.symbol, sVusdAddress])(
    "rejects a token that is not pegged: %s",
    async function (token) {
      const { exitCode, stderr } = await runCliRaw(
        approveOnFork(["--token", token, "--amount", swapAmount]),
      );
      expect(exitCode).toBe(1);
      expect(JSON.parse(stderr).error).toBe(`Not a pegged token: "${token}"`);
    },
  );

  it("rejects an amount with more decimals than the token supports", async function () {
    const { exitCode, stderr } = await runCliRaw(
      approveOnFork([
        "--token",
        vusd.symbol,
        "--amount",
        "0.0000000000000000001",
      ]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `Amount has more decimals than "${vusd.symbol}" supports: ${vusd.decimals}`,
    );
  });

  it.for(["abc", "-1"])(
    "rejects --amount %s as a usage error",
    async function (amount) {
      const { exitCode, stderr } = await runCliRaw(
        approveOnFork(["--token", vusd.symbol, "--amount", amount]),
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("option '--amount");
    },
  );

  it.for([
    [["--amount", swapAmount], "required option '--token <token>'"],
    [["--token", vusd.symbol], "required option '--amount <n>'"],
  ] as const)(
    "rejects a missing option: %s",
    async function ([extra, message]) {
      const { exitCode, stderr } = await runCliRaw(approveOnFork([...extra]));
      expect(exitCode).toBe(1);
      expect(stderr).toContain(message);
    },
  );
});
