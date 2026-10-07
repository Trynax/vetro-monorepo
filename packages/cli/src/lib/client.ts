import { createChainClient } from "@vetro-protocol/core";
import { defineChain } from "viem";
import { getChainId } from "viem/actions";
import { mainnet } from "viem/chains";

export type GlobalOptions = { rpcUrl?: string };

// Hardhat chain id when using local fork.
const localChainId = 31337;
const supportedChainIds = [mainnet.id, localChainId];

// viem's default mainnet RPC (eth.merkle.io) heavily rate-limits the CLI's requests.
const defaultRpcUrl = "https://eth.drpc.org";

const mainnetOn = (rpcUrl: string) =>
  defineChain({ ...mainnet, rpcUrls: { default: { http: [rpcUrl] } } });

export async function createVetroClient({ rpcUrl }: GlobalOptions) {
  const client = createChainClient(mainnetOn(rpcUrl ?? defaultRpcUrl));

  const chainId = await getChainId(client);
  if (!supportedChainIds.includes(chainId)) {
    throw new Error(
      `The RPC endpoint is on chain ${chainId}, but Vetro is only deployed on Ethereum mainnet (${mainnet.id}); a local fork of it (${localChainId}) is also accepted`,
    );
  }

  return { chainId, client };
}
