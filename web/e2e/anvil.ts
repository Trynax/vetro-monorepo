import { TEST_PRIVATE_KEY } from "@hemilabs/anvil-fork-setup/utils";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

export const ANVIL_PORT = 8545;
export const ANVIL_URL = `http://127.0.0.1:${ANVIL_PORT}`;

export const createEthereumClient = () =>
  createPublicClient({ chain: mainnet, transport: http(ANVIL_URL) });

export const createTestWalletClient = () =>
  createWalletClient({
    account: privateKeyToAccount(TEST_PRIVATE_KEY),
    chain: mainnet,
    transport: http(ANVIL_URL),
  });
