import { gatewayAbi, gatewayAddresses } from "@vetro-protocol/gateway";
import { getMintFee, getTreasury } from "@vetro-protocol/gateway/actions";
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

const { values } = parseArgs({
  options: {
    fee: { short: "f", type: "string" },
    "fork-url": { default: "http://127.0.0.1:8545", type: "string" },
    gateway: { short: "g", type: "string" },
    token: { short: "t", type: "string" },
  },
  strict: true,
});

if (values.gateway && !isAddress(values.gateway, { strict: false })) {
  console.error("Invalid --gateway. Must be a valid address.");
  process.exit(1);
}

const gateway = (values.gateway as Address) ?? gatewayAddresses[0];
const token = values.token;
if (!token || !isAddress(token, { strict: false })) {
  console.error("Invalid --token. Must be a valid address.");
  process.exit(1);
}

const fee = Number(values.fee);
if (!values.fee || !Number.isInteger(fee) || fee < 0 || fee > 500) {
  console.error("Invalid --fee. Must be an integer between 0 and 500 (BPS).");
  process.exit(1);
}

const transport = http(values["fork-url"]);

const publicClient = createPublicClient({
  chain: mainnet,
  transport,
});

const testClient = createTestClient({
  chain: mainnet,
  mode: "anvil",
  transport,
});

const treasury = await getTreasury(publicClient, { address: gateway });
const admin = await defaultAdmin(publicClient, { address: treasury });

await impersonateAccount(testClient, { address: admin });
await setBalance(testClient, { address: admin, value: parseEther("1") });

try {
  await ensureRole({
    account: admin,
    client: publicClient,
    role: roleId("MAINTAINER_ROLE"),
    transport,
    treasury,
  });

  console.log(`Admin: ${admin}`);
  console.log(`Gateway: ${gateway}`);
  console.log(`Token: ${token}`);

  const currentFee = await getMintFee(publicClient, {
    address: gateway,
    token,
  });

  console.log(`Current mint fee: ${currentFee} BPS`);
  console.log(`New mint fee: ${fee} BPS`);

  const hash = await writeContract(testClient, {
    abi: gatewayAbi,
    account: admin,
    address: gateway,
    args: [token, BigInt(fee)],
    functionName: "updateMintFee",
  });

  console.log(`Transaction hash: ${hash}`);

  const receipt = await confirmTransaction({ client: publicClient, hash });

  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
  console.log(`Mint fee updated: ${currentFee} -> ${fee} BPS`);
} finally {
  await stopImpersonatingAccount(testClient, { address: admin });
}
