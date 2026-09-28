import { gatewayAbi, gatewayAddresses } from "@vetro-protocol/gateway";
import {
  getTreasury,
  isInstantRedeemWhitelisted,
} from "@vetro-protocol/gateway/actions";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  type Address,
  createPublicClient,
  createTestClient,
  http,
  isAddress,
  parseEther,
} from "viem";
import {
  impersonateAccount,
  setBalance,
  stopImpersonatingAccount,
  writeContract,
} from "viem/actions";
import { mainnet } from "viem/chains";
import { roleId } from "viem-oz-access-control";
import { defaultAdmin } from "viem-oz-access-control/actions";

import { confirmTransaction, ensureRole } from "./utils.ts";

// Whitelisting for instant redeem is `onlyRole(MAINTAINER_ROLE)`, and the
// gateway delegates role checks to its Treasury (`Treasury.hasRole`). The
// treasury default admin holds DEFAULT_ADMIN_ROLE, which administers
// MAINTAINER_ROLE, so we impersonate the admin, grant it MAINTAINER_ROLE on
// the treasury, then whitelist the account on the gateway.
const MAINTAINER_ROLE = roleId("MAINTAINER_ROLE");

export async function whitelistInstantRedeem({
  address,
  forkUrl = "http://127.0.0.1:8545",
  gateway = gatewayAddresses[0],
}: {
  address: Address;
  forkUrl?: string;
  gateway?: Address;
}) {
  const transport = http(forkUrl);

  const publicClient = createPublicClient({ chain: mainnet, transport });
  const testClient = createTestClient({
    chain: mainnet,
    mode: "anvil",
    transport,
  });

  const [treasury, isWhitelisted] = await Promise.all([
    getTreasury(publicClient, { address: gateway }),
    isInstantRedeemWhitelisted(publicClient, {
      account: address,
      address: gateway,
    }),
  ]);

  if (isWhitelisted) {
    console.log(`${address} is already whitelisted for instant redeem.`);
    return;
  }

  const admin = await defaultAdmin(publicClient, { address: treasury });

  await impersonateAccount(testClient, { address: admin });
  await setBalance(testClient, { address: admin, value: parseEther("1") });

  try {
    await ensureRole({
      account: admin,
      client: publicClient,
      role: MAINTAINER_ROLE,
      transport,
      treasury,
    });

    const whitelistHash = await writeContract(testClient, {
      abi: gatewayAbi,
      account: admin,
      address: gateway,
      args: [address],
      functionName: "addToInstantRedeemWhitelist",
    });
    await confirmTransaction({ client: publicClient, hash: whitelistHash });
  } finally {
    await stopImpersonatingAccount(testClient, { address: admin });
  }

  console.log(
    `${address} whitelisted for instant redeem on gateway ${gateway}.`,
  );
}

// Allow running as a standalone script for consumers:
//   node web/scripts/whitelistInstantRedeem.ts --address 0x… [--fork-url …] [--gateway …]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      address: { short: "a", type: "string" },
      "fork-url": { short: "f", type: "string" },
      gateway: { short: "g", type: "string" },
    },
    strict: true,
  });

  if (values.gateway && !isAddress(values.gateway, { strict: false })) {
    console.error("Invalid --gateway. Must be a valid address.");
    process.exit(1);
  }

  if (!values.address || !isAddress(values.address, { strict: false })) {
    console.error(
      "Address is invalid. Usage: node web/scripts/whitelistInstantRedeem.ts --address 0xYourAddress",
    );
    process.exit(1);
  }

  await whitelistInstantRedeem({
    address: values.address,
    forkUrl: values["fork-url"],
    gateway: (values.gateway as Address) ?? gatewayAddresses[0],
  });
}
