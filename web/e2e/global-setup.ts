import { startAnvilFork } from "@hemilabs/anvil-fork-setup";
import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { mainnet } from "viem/chains";

import { fundAccount } from "../scripts/fundAccount.ts";
import { supplyMarketLiquidity } from "../scripts/supplyMarketLiquidity.ts";
import { marketIds } from "../src/constants/borrow.ts";

import { ANVIL_PORT } from "./anvil.ts";

// Reuse the app's committed RPC config as the fork upstream — anvil cannot
// fork from viem's default public RPC (rate-limited). Vite only loads .env
// for the app itself; globalSetup runs in plain Node, so load it explicitly.
// loadEnvFile never overrides existing vars, so real env vars still win.
process.loadEnvFile(new URL("../.env", import.meta.url));

export default async function globalSetup() {
  const { stop, url } = await startAnvilFork({
    chainId: mainnet.id,
    forkUrl:
      process.env.VITE_RPC_URL_MAINNET ?? mainnet.rpcUrls.default.http[0],
    port: ANVIL_PORT,
  });
  try {
    await fundAccount({ address: TEST_ADDRESS, forkUrl: url });
    await supplyMarketLiquidity({
      amount: "100000",
      forkUrl: url,
      marketId: marketIds[0],
    });
  } catch (error) {
    await stop();
    throw error;
  }
  return stop;
}
