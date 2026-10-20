import {
  type Address,
  type Client,
  createWalletClient,
  type Hash,
  type Hex,
  type Transport,
} from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { mainnet } from "viem/chains";
import { grantRole, hasRole } from "viem-oz-access-control/actions";

export async function confirmTransaction({
  client,
  hash,
}: {
  client: Client;
  hash: Hash;
}) {
  const receipt = await waitForTransactionReceipt(client, { hash });

  if (receipt.status !== "success") {
    throw new Error(`Transaction ${hash} reverted`);
  }

  return receipt;
}

export async function ensureRole({
  account,
  client,
  role,
  transport,
  treasury,
}: {
  account: Address;
  client: Client;
  role: Hex;
  transport: Transport;
  treasury: Address;
}) {
  const accountHasRole = await hasRole(client, {
    account,
    address: treasury,
    role,
  });

  if (accountHasRole) {
    return;
  }

  const hash = await grantRole(
    createWalletClient({ account, chain: mainnet, transport }),
    { account, address: treasury, role },
  );
  await confirmTransaction({ client, hash });
}
