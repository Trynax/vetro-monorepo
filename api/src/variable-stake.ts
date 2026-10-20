import { createMainnetClient } from "@vetro-protocol/core";
import { stakingVaultAddresses } from "@vetro-protocol/earn";
import {
  getPeriodFinish,
  getRewardRate,
  getYieldDistributor,
} from "@vetro-protocol/earn/actions";
import { getPeggedToken } from "@vetro-protocol/gateway/actions";
import { type Address, checksumAddress, type Hash } from "viem";
import { mainnet } from "viem/chains";
import { convertToAssets, totalAssets } from "viem-erc4626/actions";

import { aprWadToApy } from "./apr-wad-to-apy.ts";
import * as graphql from "./graphql.ts";
import * as merkl from "./merkl.ts";
import { findStakingVaultForPeggedToken } from "./staking-vault.ts";

const WAD = 10n ** 18n;
const SECONDS_PER_YEAR = 31_536_000n; // 365 days

/**
 * Query the subgraph for the user's staking positions across all known vaults
 * and return the cost basis (in pegged-token asset units) for each. The
 * subgraph stores `totalCostBasis` as a WAD-scaled sum of deposits, so this
 * scales it back down to asset units. Defaults to 0n when the user has no
 * position for a vault.
 */
export async function getCostBasis({
  address,
  url,
}: {
  address: string;
  url: string;
}) {
  const query = `
    query ($owner: Bytes!, $vaults: [Bytes!]!) {
      userStakingPositions(
        where: { owner: $owner, stakingVaultAddress_in: $vaults }
      ) {
        stakingVaultAddress
        totalCostBasis
      }
    }`;
  const variables = {
    owner: address.toLowerCase(),
    vaults: stakingVaultAddresses.map((v) => v.toLowerCase()),
  };
  const { userStakingPositions } = await graphql.runQuery<{
    userStakingPositions: {
      stakingVaultAddress: `0x${string}`;
      totalCostBasis: string;
    }[];
  }>({ query, url, variables });
  if (!Array.isArray(userStakingPositions)) {
    throw new Error(
      `Invalid subgraph response for staking positions of ${address}`,
    );
  }
  // Pre-seed every known vault with "0" so the response shape is stable.
  const result = Object.fromEntries(
    stakingVaultAddresses.map((vault) => [vault, 0n]),
  );
  for (const position of userStakingPositions) {
    const totalCostBasis = BigInt(position.totalCostBasis);
    result[checksumAddress(position.stakingVaultAddress)] =
      totalCostBasis / WAD;
  }
  return result;
}

/**
 * Read a single staking vault's current forward-looking APY from chain: read the
 * `rewardRate` from the vault's `YieldDistributor` and annualize it over the vault's
 * `totalAssets()`. Yield is dripped into the vault's asset balance (raising the
 * ERC4626 share price), so the reward and staked asset are the same token and no
 * price conversion is needed. Returns 0 when the reads succeed but no drip is active
 * (period ended, zero rate, or empty vault). Throws if any on-chain read fails, so
 * callers decide how to surface that (omit the vault, or fall back to history).
 */
async function computeVaultApy({
  client,
  vaultAddress,
}: {
  client: ReturnType<typeof createMainnetClient>;
  vaultAddress: Address;
}) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const totalAssetsPromise = totalAssets(client, { address: vaultAddress });
  const distributorReadsPromise = getYieldDistributor(client, {
    address: vaultAddress,
  }).then((distributorAddress) =>
    Promise.all([
      getPeriodFinish(client, { address: distributorAddress }),
      getRewardRate(client, { address: distributorAddress }),
    ]),
  );
  const [[periodFinish, rewardRate], assets] = await Promise.all([
    distributorReadsPromise,
    totalAssetsPromise,
  ]);

  if (periodFinish >= now && rewardRate > 0n && assets > 0n) {
    // rewardRate is WAD-scaled reward per second. The WAD scale cancels the
    // rewardRate's own WAD scaling, so aprWad = (rewardRate * SECONDS_PER_YEAR) /
    // assets.
    return aprWadToApy((rewardRate * SECONDS_PER_YEAR) / assets);
  }
  return 0;
}

/**
 * Compute a forward-looking APY for each configured staking vault via
 * `computeVaultApy`. Returns a record keyed by checksummed vault address. A vault is
 * included with `{ apy: 0 }` when its reads succeed but no drip is active; a vault
 * whose on-chain reads fail is omitted entirely so the frontend can render "-" for
 * it, distinct from a genuine 0% APY.
 */
export async function getApy({ rpcUrl }: { rpcUrl: string | undefined }) {
  const client = createMainnetClient(rpcUrl);

  const entries = await Promise.all(
    stakingVaultAddresses.map(async function (vaultAddress) {
      try {
        const apy = await computeVaultApy({ client, vaultAddress });
        return [vaultAddress, { apy }] as const;
      } catch (error) {
        // Omit this vault from the response so the frontend shows "-" rather
        // than a misleading 0%. A single vault's failed on-chain reads (e.g.
        // an unconfigured distributor or RPC error) must not affect the rest.
        console.warn(
          `Failed to compute APY for vault ${vaultAddress}: ${error.message}`,
        );
        return null;
      }
    }),
  );

  return Object.fromEntries(
    entries.filter((entry) => entry !== null),
  ) as Record<Address, { apy: number }>;
}

/**
 * Every configured vault gets an entry in the result, with an empty array if
 * the user has no rewards for that vault (including vaults whose Merkl
 * opportunity id is not configured).
 */
export async function getUserRewards({
  address,
  vaultOpportunities,
}: {
  address: Address;
  vaultOpportunities: Record<Address, string | undefined>;
}) {
  const vaultEntries = Object.entries(vaultOpportunities) as [
    Address,
    string | undefined,
  ][];

  // Only vaults with a configured opportunity id need a campaigns lookup; the
  // rest will still appear in the response with an empty rewards array.
  const vaultsWithOpportunity = vaultEntries.filter(
    ([, opportunityId]) => !!opportunityId,
  ) as [Address, string][];

  // Pre-seed every configured vault with an empty array so the response shape
  // is stable: callers can rely on every vault key being present even when a
  // user has no rewards for it.
  const rewardsByVault: Record<
    Address,
    Awaited<ReturnType<typeof merkl.getUserRewards>>[number]["rewards"]
  > = Object.fromEntries(
    vaultEntries.map(([vaultAddress]) => [vaultAddress, []]),
  );

  // Skip the external Merkl call when no vault has a configured opportunity:
  // there are no campaigns to map rewards to, so the response is the
  // pre-seeded empties.
  if (vaultsWithOpportunity.length === 0) {
    return rewardsByVault;
  }

  // Each vault maps to one Merkl opportunity, and each opportunity contains
  // multiple campaigns. Resolve the campaigns for every configured opportunity,
  // in parallel with the user's full reward list.
  const [campaignsPerVault, allUserRewards] = await Promise.all([
    Promise.all(
      vaultsWithOpportunity.map(async function ([vaultAddress, opportunityId]) {
        const { campaigns } = await merkl.getOpportunityCampaigns({
          opportunityId,
        });
        return [vaultAddress, campaigns.map((c) => c.campaignId)] as const;
      }),
    ),
    merkl.getUserRewards({ address, chainId: mainnet.id }),
  ]);

  // Reverse index: campaignId -> vault. Merkl rewards reference campaigns (not
  // opportunities/vaults) in their breakdowns, so this is what lets us attribute
  // each reward back to a vault below.
  const campaignIdToVault = Object.fromEntries(
    campaignsPerVault.flatMap(([vaultAddress, campaignIds]) =>
      campaignIds.map((campaignId) => [campaignId, vaultAddress] as const),
    ),
  ) as Record<string, Address>;

  // Bucket each reward into the vault(s) it belongs to. A reward's breakdowns
  // can list multiple campaigns; `seen` prevents pushing the same reward twice
  // into the same vault when several breakdowns map to it.
  for (const userRewards of allUserRewards) {
    for (const reward of userRewards.rewards) {
      const seen = new Set<Address>();
      for (const breakdown of reward.breakdowns) {
        const vaultAddress = campaignIdToVault[breakdown.campaignId];
        if (vaultAddress && !seen.has(vaultAddress)) {
          seen.add(vaultAddress);
          rewardsByVault[vaultAddress].push(reward);
        }
      }
    }
  }

  return rewardsByVault;
}

type ExitTicket = {
  assets: string;
  cancelTxHash?: Hash | null;
  claimableAt: number;
  claimTxHash?: Hash | null;
  owner: Address;
  requestId: string;
  requestTxHash: Hash;
  shares: string;
  stakingVaultAddress: Address;
};

/**
 * Query the subgraph. Get all exit tickets for the user. No pagination is
 * supported. If more than 100 entities exist, pagination will have to be
 * implemented in the query. Then the function may have to support returning
 * paginated results too.
 */
export async function getUserExitTickets({
  address,
  url,
}: {
  address: string;
  url: string;
}): Promise<ExitTicket[]> {
  const query = `
    query ($owner: Bytes!) {
      exitTickets(orderBy: claimableAt, where: { owner: $owner }) {
        assets
        cancelTxHash
        claimableAt
        claimTxHash
        owner
        requestId
        requestTxHash
        shares
        stakingVaultAddress
      }
    }`;
  const variables = {
    owner: address.toLowerCase(),
  };
  const { exitTickets } = await graphql.runQuery<{
    exitTickets: ExitTicket[];
  }>({ query, url, variables });
  if (!Array.isArray(exitTickets)) {
    throw new Error(`Invalid subgraph response for exit tickets of ${address}`);
  }
  if (exitTickets.length === 100) {
    // TODO https://github.com/vetro-protocol/vetro-monorepo/issues/339
    console.warn(
      `Got exactly 100 exit tickets for ${address}. Implement pagination!`,
    );
  }
  return exitTickets.map((ticket) => ({
    ...ticket,
    owner: checksumAddress(ticket.owner),
    stakingVaultAddress: checksumAddress(ticket.stakingVaultAddress),
  }));
}

/**
 * Queries the subgraph for all open exit tickets scoped to the given gateway's
 * staking vault and returns the number of open tickets and their combined
 * value in the vault's underlying asset (shares converted via the vault's
 * exchange rate).
 */
export async function getExitTicketQueueSize({
  gatewayAddress,
  rpcUrl,
  subgraphUrl,
}: {
  gatewayAddress: Address;
  rpcUrl: string | undefined;
  subgraphUrl: string;
}) {
  const client = createMainnetClient(rpcUrl);
  const peggedTokenAddress = await getPeggedToken(client, {
    address: gatewayAddress,
  });
  const stakingVaultAddress = await findStakingVaultForPeggedToken({
    client,
    peggedTokenAddress,
  });
  const query = `
    query ($stakingVault: Bytes!) {
      exitTickets(
        first: 100,
        where: {
          stakingVaultAddress: $stakingVault,
          cancelTxHash: null,
          claimTxHash: null
        }
      ) {
        shares
      }
    }`;
  const variables = { stakingVault: stakingVaultAddress.toLowerCase() };
  const { exitTickets } = await graphql.runQuery<{
    exitTickets: { shares: string }[];
  }>({ query, url: subgraphUrl, variables });
  if (!Array.isArray(exitTickets)) {
    throw new Error(
      `Invalid subgraph response for exit tickets of vault ${stakingVaultAddress}`,
    );
  }
  // TODO https://github.com/vetro-protocol/vetro-monorepo/issues/339
  if (exitTickets.length === 100) {
    console.warn(
      `Got exactly 100 open exit tickets for vault ${stakingVaultAddress}. Implement pagination!`,
    );
  }
  const shares = exitTickets.reduce(
    (acc, ticket) => acc + BigInt(ticket.shares),
    0n,
  );
  const assets = await convertToAssets(client, {
    address: stakingVaultAddress,
    shares,
  });
  return {
    assets,
    openTickets: exitTickets.length,
  };
}
