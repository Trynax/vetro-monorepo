import { gateways } from "@vetro-protocol/core";
import { gatewayAddresses } from "@vetro-protocol/gateway";
import { getPeggedToken, getTreasury } from "@vetro-protocol/gateway/actions";
import { getWhitelistedTokens } from "@vetro-protocol/treasury/actions";
import { type Address, type Client, isAddress, isAddressEqual } from "viem";
import { decimals, symbol } from "viem-erc20/actions";

type Candidate = {
  address: Address;
  gatewayAddress: Address;
};

export const isTokenMatch = ({
  token,
  value,
}: {
  token: { address: Address; symbol: string };
  value: string;
}) =>
  isAddress(value, { strict: false })
    ? isAddressEqual(token.address, value)
    : token.symbol.toLowerCase() === value.toLowerCase();

const getWhitelistedCandidates = async function (client: Client) {
  const perGateway = await Promise.all(
    gatewayAddresses.map(async function (gatewayAddress) {
      const treasury = await getTreasury(client, { address: gatewayAddress });
      const tokens = await getWhitelistedTokens(client, { address: treasury });
      return tokens.map((address) => ({ address, gatewayAddress }));
    }),
  );
  return perGateway.flat();
};

const getPeggedCandidates = (client: Client) =>
  Promise.all(
    gatewayAddresses.map(async (gatewayAddress) => ({
      address: await getPeggedToken(client, { address: gatewayAddress }),
      gatewayAddress,
    })),
  );

const filterMatching = async function ({
  candidates,
  client,
  value,
}: {
  candidates: Candidate[];
  client: Client;
  value: string;
}) {
  if (isAddress(value, { strict: false })) {
    return candidates.filter((candidate) =>
      isAddressEqual(candidate.address, value),
    );
  }
  const symbols = await Promise.all(
    candidates.map((candidate) =>
      symbol(client, { address: candidate.address }),
    ),
  );
  return candidates.filter(
    (_candidate, index) => symbols[index].toLowerCase() === value.toLowerCase(),
  );
};

const resolveCandidate = async function ({
  candidates,
  client,
  kind,
  value,
}: {
  candidates: Candidate[];
  client: Client;
  kind: string;
  value: string;
}) {
  const matches = await filterMatching({ candidates, client, value });

  if (matches.length === 0) {
    throw new Error(`Not a ${kind} token: "${value}"`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous token "${value}": matched on more than one gateway`,
    );
  }

  const [match] = matches;
  return {
    ...match,
    decimals: await decimals(client, { address: match.address }),
  };
};

/**
 * Resolves a whitelisted token by symbol or address, along with the gateway
 * that accepts it. A whitelisted token has no on-chain pointer back to its
 * gateway, so the gateways' treasuries are walked to find it.
 */
export const resolveWhitelistedToken = async ({
  client,
  value,
}: {
  client: Client;
  value: string;
}) =>
  resolveCandidate({
    candidates: await getWhitelistedCandidates(client),
    client,
    kind: "whitelisted",
    value,
  });

export const resolvePeggedToken = async ({
  client,
  value,
}: {
  client: Client;
  value: string;
}) =>
  resolveCandidate({
    candidates: await getPeggedCandidates(client),
    client,
    kind: "pegged",
    value,
  });

/**
 * Resolves either side of a swap by symbol or address: a whitelisted token,
 * spent by the gateway on swap-in, or a pegged token, spent by the gateway on
 * swap-out.
 */
export async function resolveSwapToken({
  client,
  value,
}: {
  client: Client;
  value: string;
}) {
  const [whitelisted, pegged] = await Promise.all([
    getWhitelistedCandidates(client),
    getPeggedCandidates(client),
  ]);
  return resolveCandidate({
    candidates: [...whitelisted, ...pegged],
    client,
    kind: "whitelisted or pegged",
    value,
  });
}

export async function getGatewayPeggedToken({
  client,
  gatewayAddress,
}: {
  client: Client;
  gatewayAddress: Address;
}) {
  const address = await getPeggedToken(client, { address: gatewayAddress });
  const [tokenDecimals, tokenSymbol] = await Promise.all([
    decimals(client, { address }),
    symbol(client, { address }),
  ]);
  return { address, decimals: tokenDecimals, symbol: tokenSymbol };
}

function withStakingVault<T extends { gatewayAddress: Address }>({
  token,
  value,
}: {
  token: T;
  value: string;
}) {
  const stakingVault = gateways.find((gateway) =>
    isAddressEqual(gateway.address, token.gatewayAddress),
  )?.stakingVault;
  if (!stakingVault) {
    throw new Error(`No staking vault for pegged token: "${value}"`);
  }
  return { ...token, stakingVault };
}

/**
 * Resolves a pegged token by symbol or address, along with its staking vault.
 */
export async function resolveStakablePeggedToken({
  client,
  value,
}: {
  client: Client;
  value: string;
}) {
  const token = await resolvePeggedToken({ client, value });
  return withStakingVault({ token, value });
}

const getShareCandidates = () =>
  gateways.flatMap(({ address, stakingVault }) =>
    stakingVault ? [{ address: stakingVault, gatewayAddress: address }] : [],
  );

/**
 * Resolves either side of a stake by symbol or address, along with its
 * staking vault: a pegged token, or its share token, which is the staking
 * vault itself.
 */
export async function resolveStakingToken({
  client,
  value,
}: {
  client: Client;
  value: string;
}) {
  const token = await resolveCandidate({
    candidates: [
      ...(await getPeggedCandidates(client)),
      ...getShareCandidates(),
    ],
    client,
    kind: "pegged or share",
    value,
  });
  return withStakingVault({ token, value });
}
