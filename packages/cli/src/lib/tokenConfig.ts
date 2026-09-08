import { getTokenConfig } from "@vetro-protocol/treasury/actions";
import { type Address, type Client } from "viem";

export type TokenConfig = {
  decimals: number;
  depositActive: boolean;
  oracle: Address;
  stalePeriod: bigint;
  vault: Address;
  withdrawActive: boolean;
};

/**
 * Reads a whitelisted token's treasury config as named fields. The action
 * returns the contract's positional tuple, so this is the only place that
 * depends on the order of its fields.
 */
export async function readTokenConfig({
  client,
  token,
  treasury,
}: {
  client: Client;
  token: Address;
  treasury: Address;
}) {
  const [vault, oracle, stalePeriod, depositActive, withdrawActive, decimals] =
    await getTokenConfig(client, { address: treasury, token });
  return {
    decimals,
    depositActive,
    oracle,
    stalePeriod,
    vault,
    withdrawActive,
  } satisfies TokenConfig;
}
