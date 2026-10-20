import { gatewayAddresses } from "@vetro-protocol/gateway";
import { describe, expect, inject, it } from "vitest";

import {
  type RedeemRequest,
  requestArgs,
  runCli,
  runCliRaw,
  usdc,
} from "./helpers.ts";

describe("swap request", function () {
  const rpcUrl = inject("anvilUrl");
  const [gateway] = gatewayAddresses;
  const account = "0x00000000000000000000000000000000000000A1";

  const requestOnFork = (extra: string[] = []) => [
    ...requestArgs(extra),
    "--rpc-url",
    rpcUrl,
  ];

  it("prints status none for an account with no open request", async function () {
    const request = await runCli<RedeemRequest>(
      requestOnFork(["--account", account, "--gateway", gateway]),
    );

    expect(request).toEqual({
      amountLocked: "0",
      claimableAt: "0",
      status: "none",
    });
  });

  it("accepts non-checksummed addresses", async function () {
    const request = await runCli<RedeemRequest>(
      requestOnFork([
        "--account",
        account.toLowerCase(),
        "--gateway",
        gateway.toLowerCase(),
      ]),
    );

    expect(request.status).toBe("none");
  });

  it("rejects an address that is not an enabled gateway", async function () {
    const { exitCode, stderr } = await runCliRaw(
      requestOnFork(["--account", account, "--gateway", usdc.address]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain(`Not an enabled gateway: "${usdc.address}"`);
  });

  it("rejects an invalid account address", async function () {
    const { exitCode, stderr } = await runCliRaw(
      requestOnFork(["--account", "notanaddress", "--gateway", gateway]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid address: "notanaddress"');
  });

  it("rejects a missing --account", async function () {
    const { exitCode, stderr } = await runCliRaw(
      requestOnFork(["--gateway", gateway]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("required option '--account <addr>'");
  });

  it("rejects a missing --gateway", async function () {
    const { exitCode, stderr } = await runCliRaw(
      requestOnFork(["--account", account]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("required option '--gateway <addr>'");
  });
});
