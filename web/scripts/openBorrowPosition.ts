import { getChainAddresses } from "@morpho-org/blue-sdk";
import { morphoBlueAbi } from "@vetro-protocol/morpho-blue-market";
import { getMarketParams } from "@vetro-protocol/morpho-blue-market/actions";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  type Address,
  type Hash,
  createPublicClient,
  createTestClient,
  http,
  isAddress,
  isHash,
  parseUnits,
} from "viem";
import {
  impersonateAccount,
  stopImpersonatingAccount,
  writeContract,
} from "viem/actions";
import { mainnet } from "viem/chains";
import { approve, decimals } from "viem-erc20/actions";

import { fastForwardTime } from "./fastForwardTime.ts";
import { confirmTransaction } from "./utils.ts";

export async function openBorrowPosition({
  address,
  borrowAmount,
  collateralAmount,
  forkUrl = "http://127.0.0.1:8545",
  marketId,
}: {
  address: Address;
  borrowAmount: string;
  collateralAmount: string;
  forkUrl?: string;
  marketId: Hash;
}) {
  const transport = http(forkUrl);

  const publicClient = createPublicClient({ chain: mainnet, transport });
  const testClient = createTestClient({
    account: address,
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

  const [collateralDecimals, loanDecimals] = await Promise.all([
    decimals(publicClient, { address: marketParams.collateralToken }),
    decimals(publicClient, { address: marketParams.loanToken }),
  ]);
  const collateralAssets = parseUnits(collateralAmount, collateralDecimals);
  const borrowAssets = parseUnits(borrowAmount, loanDecimals);

  await impersonateAccount(testClient, { address });

  try {
    const approveHash = await approve(testClient, {
      address: marketParams.collateralToken,
      amount: collateralAssets,
      spender: morpho,
    });
    await confirmTransaction({ client: publicClient, hash: approveHash });

    const supplyHash = await writeContract(testClient, {
      abi: morphoBlueAbi,
      address: morpho,
      args: [marketParams, collateralAssets, address, "0x"],
      functionName: "supplyCollateral",
    });
    await confirmTransaction({ client: publicClient, hash: supplyHash });

    // Without a clock step, the gas estimate skips interest accrual and the borrow runs out of gas.
    await fastForwardTime({ forkUrl, seconds: 60 });

    const borrowHash = await writeContract(testClient, {
      abi: morphoBlueAbi,
      address: morpho,
      args: [marketParams, borrowAssets, 0n, address, address],
      functionName: "borrow",
    });
    await confirmTransaction({ client: publicClient, hash: borrowHash });
  } finally {
    await stopImpersonatingAccount(testClient, { address });
  }

  console.log(
    `Opened a position on Morpho market ${marketId} for ${address}: supplied ${collateralAmount}, borrowed ${borrowAmount}.`,
  );
}

// Allow running as a standalone script:
//   node web/scripts/openBorrowPosition.ts --address 0x… --market 0x… --collateral 0.05 --borrow 1000
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const usage =
    "node web/scripts/openBorrowPosition.ts --address 0xYourAddress --market 0xMarketId --collateral 0.05 --borrow 1000";

  const { values } = parseArgs({
    options: {
      address: { short: "a", type: "string" },
      borrow: { short: "b", type: "string" },
      collateral: { short: "c", type: "string" },
      "fork-url": { short: "f", type: "string" },
      market: { short: "m", type: "string" },
    },
    strict: true,
  });

  if (!values.address || !isAddress(values.address, { strict: false })) {
    console.error(`Address is invalid. Usage: ${usage}`);
    process.exit(1);
  }

  if (!values.market || !isHash(values.market)) {
    console.error(`Market ID is invalid. Usage: ${usage}`);
    process.exit(1);
  }

  if (!values.collateral || !/^\d+(\.\d+)?$/.test(values.collateral)) {
    console.error(`Collateral amount is invalid. Usage: ${usage}`);
    process.exit(1);
  }

  if (!values.borrow || !/^\d+(\.\d+)?$/.test(values.borrow)) {
    console.error(`Borrow amount is invalid. Usage: ${usage}`);
    process.exit(1);
  }

  await openBorrowPosition({
    address: values.address,
    borrowAmount: values.borrow,
    collateralAmount: values.collateral,
    forkUrl: values["fork-url"],
    marketId: values.market,
  });
}
