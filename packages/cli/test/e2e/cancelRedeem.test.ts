import { gatewayAddresses } from "@vetro-protocol/gateway";
import { describe, expect, inject, it } from "vitest";

import { cancelRedeemArgs, runCliRaw, usdc } from "./helpers.ts";

describe("swap cancel-redeem", function () {
  const rpcUrl = inject("anvilUrl");
  const [gateway] = gatewayAddresses;
  const account = "0x00000000000000000000000000000000000000A1";

  const cancelRedeemOnFork = (extra: string[] = []) => [
    ...cancelRedeemArgs(extra),
    "--rpc-url",
    rpcUrl,
  ];

  it("rejects an account with no open request", async function () {
    const { exitCode, stderr } = await runCliRaw(
      cancelRedeemOnFork(["--account", account, "--gateway", gateway]),
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr).error).toBe(
      `No open redeem request for "${account}" on the gateway`,
    );
  });

  it("rejects an address that is not an enabled gateway", async function () {
    const { exitCode, stderr } = await runCliRaw(
      cancelRedeemOnFork(["--account", account, "--gateway", usdc.address]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain(`Not an enabled gateway: "${usdc.address}"`);
  });

  it("rejects an invalid account address", async function () {
    const { exitCode, stderr } = await runCliRaw(
      cancelRedeemOnFork(["--account", "notanaddress", "--gateway", gateway]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid address: "notanaddress"');
  });

  it("rejects a missing --account", async function () {
    const { exitCode, stderr } = await runCliRaw(
      cancelRedeemOnFork(["--gateway", gateway]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("required option '--account <addr>'");
  });

  it("rejects a missing --gateway", async function () {
    const { exitCode, stderr } = await runCliRaw(
      cancelRedeemOnFork(["--account", account]),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("required option '--gateway <addr>'");
  });
});
