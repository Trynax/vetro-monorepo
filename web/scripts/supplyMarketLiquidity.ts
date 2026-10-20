import { getChainAddresses } from "@morpho-org/blue-sdk";
import { blueAbi } from "@morpho-org/blue-sdk-viem";
import { knownTokens } from "@vetro-protocol/core";
import { getMarketParams } from "@vetro-protocol/morpho-blue-market/actions";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  type Address,
  type Hash,
  createPublicClient,
  createTestClient,
  http,
  isAddressEqual,
  isHash,
  parseUnits,
} from "viem";
import {
  impersonateAccount,
  stopImpersonatingAccount,
  writeContract,
} from "viem/actions";
import { mainnet } from "viem/chains";
import { approve } from "viem-erc20/actions";

import { fundAccount } from "./fundAccount.ts";
import { confirmTransaction } from "./utils.ts";

// Anvil's second default account
const defaultSupplier: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

export async function supplyMarketLiquidity({
  amount,
  forkUrl = "http://127.0.0.1:8545",
  marketId,
  supplier = defaultSupplier,
}: {
  amount: string;
  forkUrl?: string;
  marketId: Hash;
  supplier?: Address;
}) {
  const transport = http(forkUrl);

  const publicClient = createPublicClient({ chain: mainnet, transport });
  const testClient = createTestClient({
    account: supplier,
    chain: mainnet,
    mode: "anvil",
    transport,
  });

  const morpho = getChainAddresses(mainnet.id).blue;
  const marketParams = await getMarketParams({
    address: morpho,
    client: publicClient,
    marketId,
  });

  const loanToken = knownTokens.find(
    (t) =>
      t.chainId === mainnet.id &&
      isAddressEqual(t.address, marketParams.loanToken),
  );
  if (loanToken?.extensions?.balanceSlot === undefined) {
    throw new Error(`No balance slot known for ${marketParams.loanToken}`);
  }

  const assets = parseUnits(amount, loanToken.decimals);

  await fundAccount({
    address: supplier,
    amount: BigInt(amount),
    forkUrl,
    tokens: [
      {
        address: loanToken.address,
        balanceSlot: loanToken.extensions.balanceSlot,
        decimals: loanToken.decimals,
        symbol: loanToken.symbol,
      },
    ],
  });

  await impersonateAccount(testClient, { address: supplier });

  try {
    const approveHash = await approve(testClient, {
      address: loanToken.address,
      amount: assets,
      spender: morpho,
    });
    await confirmTransaction({ client: publicClient, hash: approveHash });

    const supplyHash = await writeContract(testClient, {
      abi: blueAbi,
      address: morpho,
      args: [marketParams, assets, 0n, supplier, "0x"],
      functionName: "supply",
    });
    await confirmTransaction({ client: publicClient, hash: supplyHash });
  } finally {
    await stopImpersonatingAccount(testClient, { address: supplier });
  }

  console.log(
    `Supplied ${amount} ${loanToken.symbol} to Morpho market ${marketId}.`,
  );
}

// Allow running as a standalone script:
//   node web/scripts/supplyMarketLiquidity.ts --market 0x… --amount 100000
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const usage =
    "node web/scripts/supplyMarketLiquidity.ts --market 0xMarketId --amount 100000";

  const { values } = parseArgs({
    options: {
      amount: { type: "string" },
      "fork-url": { short: "f", type: "string" },
      market: { short: "m", type: "string" },
    },
    strict: true,
  });

  if (!values.market || !isHash(values.market)) {
    console.error(`Market ID is invalid. Usage: ${usage}`);
    process.exit(1);
  }

  if (!values.amount || !/^\d+$/.test(values.amount)) {
    console.error(`Amount must be a whole number. Usage: ${usage}`);
    process.exit(1);
  }

  await supplyMarketLiquidity({
    amount: values.amount,
    forkUrl: values["fork-url"],
    marketId: values.market,
  });
}
