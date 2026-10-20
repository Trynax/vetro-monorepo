import { gatewayAbi, gatewayAddresses } from "@vetro-protocol/gateway";
import {
  getTreasury,
  getWithdrawalDelay,
  getWithdrawalDelayEnabled,
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

const WITHDRAWAL_DELAY_SECONDS = 72n;

const MAINTAINER_ROLE = roleId("MAINTAINER_ROLE");

// Enable or disable the gateway's withdrawal delay by impersonating its
// treasury's default admin.
// When enabling, also remove the address from the instant-redeem whitelist so it
// is forced down the two-step (request → wait → claim) redeem path.
export async function setRedeemDelay({
  address,
  enableDelay,
  forkUrl,
  gateway = gatewayAddresses[0],
}: {
  address: Address;
  enableDelay: boolean;
  forkUrl: string;
  gateway?: Address;
}) {
  const transport = http(forkUrl);

  const publicClient = createPublicClient({ chain: mainnet, transport });
  const testClient = createTestClient({
    chain: mainnet,
    mode: "anvil",
    transport,
  });

  const [treasury, delayEnabledBefore] = await Promise.all([
    getTreasury(publicClient, { address: gateway }),
    getWithdrawalDelayEnabled(publicClient, { address: gateway }),
  ]);
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

    if (enableDelay) {
      if (!delayEnabledBefore) {
        const hash = await writeContract(testClient, {
          abi: gatewayAbi,
          account: admin,
          address: gateway,
          args: [true],
          functionName: "setWithdrawalDelayEnabled",
        });
        await confirmTransaction({ client: publicClient, hash });
      }

      const [, isWhitelisted] = await Promise.all([
        writeContract(testClient, {
          abi: gatewayAbi,
          account: admin,
          address: gateway,
          args: [WITHDRAWAL_DELAY_SECONDS],
          functionName: "updateWithdrawalDelay",
        }).then((hash) => confirmTransaction({ client: publicClient, hash })),
        isInstantRedeemWhitelisted(publicClient, {
          account: address,
          address: gateway,
        }),
      ]);

      if (isWhitelisted) {
        const hash = await writeContract(testClient, {
          abi: gatewayAbi,
          account: admin,
          address: gateway,
          args: [address],
          functionName: "removeFromInstantRedeemWhitelist",
        });
        await confirmTransaction({ client: publicClient, hash });
      }
    } else if (delayEnabledBefore) {
      const hash = await writeContract(testClient, {
        abi: gatewayAbi,
        account: admin,
        address: gateway,
        args: [false],
        functionName: "setWithdrawalDelayEnabled",
      });
      await confirmTransaction({ client: publicClient, hash });
    }

    const [delayEnabledAfter, delay] = await Promise.all([
      getWithdrawalDelayEnabled(publicClient, { address: gateway }),
      getWithdrawalDelay(publicClient, { address: gateway }),
    ]);

    return { delay, delayEnabledAfter, delayEnabledBefore };
  } finally {
    await stopImpersonatingAccount(testClient, { address: admin });
  }
}

// Allow running as a standalone script:
//   node web/scripts/redeemDelay.ts --address 0xYourAddress --delay|--no-delay
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      address: { short: "a", type: "string" },
      delay: { type: "boolean" },
      "fork-url": { short: "f", type: "string" },
      gateway: { short: "g", type: "string" },
      "no-delay": { type: "boolean" },
    },
    strict: true,
  });

  if (values.gateway && !isAddress(values.gateway, { strict: false })) {
    console.error("Invalid --gateway. Must be a valid address.");
    process.exit(1);
  }

  if (!values.address || !isAddress(values.address, { strict: false })) {
    console.error(
      "Address is invalid. Usage: node web/scripts/redeemDelay.ts --address 0xYourAddress --delay|--no-delay",
    );
    process.exit(1);
  }

  if (values.delay === values["no-delay"]) {
    console.error("Exactly one of --delay or --no-delay must be provided.");
    process.exit(1);
  }

  const { delay, delayEnabledAfter, delayEnabledBefore } = await setRedeemDelay(
    {
      address: values.address,
      enableDelay: Boolean(values.delay),
      forkUrl: values["fork-url"] ?? "http://127.0.0.1:8545",
      gateway: values.gateway as Address | undefined,
    },
  );

  console.log(
    `withdrawalDelayEnabled: ${delayEnabledBefore} -> ${delayEnabledAfter}`,
  );
  console.log(`withdrawalDelay: ${delay}s`);
}
