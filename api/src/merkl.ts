import fetchJson from "tiny-fetch-json";
import type { Address, Hash } from "viem";

import { queryStringObjectToString } from "./querystring-object-to-string.ts";

type MerklBreakdown = {
  amount: string;
  campaignId: string;
  claimed: string;
  distributionChainId: number;
  pending: string;
  reason: string;
  root: `0x${string}`;
  subCampaignId: string;
};

type MerklToken = {
  address: `0x${string}`;
  chainId: number;
  decimals: number;
  price: number;
  symbol: string;
};

type MerklReward = {
  amount: string;
  breakdowns: MerklBreakdown[];
  claimed: string;
  distributionChainId: number;
  pending: string;
  proofs: `0x${string}`[];
  recipient: `0x${string}`;
  root: `0x${string}`;
  token: MerklToken;
};

type MerklUserRewardsResponse = {
  rewards: MerklReward[];
}[];

type RewardToken = {
  address: `0x${string}`;
  chainId: number;
  symbol: string;
};

type MerklCampaign = {
  apr: number;
  campaignId: string;
  endTimestamp: number;
  id: string;
  rewardToken: RewardToken;
  status: string;
};

type MerklOpportunityResponse = {
  apr: number;
  campaigns: MerklCampaign[];
  chainId: number;
  id: string;
  status: "LIVE" | "PAST";
};

type MerklLiveCampaign = {
  apr: number;
  campaignId: Hash;
  endTimestamp: number | string;
  rewardToken: Omit<RewardToken, "symbol">;
  startTimestamp: number | string;
};

type MerklLiveOpportunity = {
  campaigns: MerklLiveCampaign[];
  chainId: number;
  id: string;
  identifier: Address;
};

const fetchMerkl = function <R>(
  endpoint: string,
  options?: {
    query?: Record<string, string>;
  },
): Promise<R> {
  const url =
    "https://api.merkl.xyz" +
    `/v4${endpoint}` +
    `${queryStringObjectToString(options?.query)}`;
  return fetchJson(url);
};

/**
 * Fetches user rewards from the Merkl API for a specific address and chain.
 *
 * For more information about integrating user rewards, see:
 * https://docs.merkl.xyz/integrate-merkl/app#integrating-user-rewards
 *
 * @param params - Configuration object
 * @param params.address - The user's wallet address to fetch rewards for
 * @param params.chainId - The chain ID to fetch rewards from
 * @returns An array of user rewards
 */
export async function getUserRewards({
  address,
  chainId,
}: {
  address: `0x${string}`;
  chainId: number;
}) {
  const chainIdStr = chainId.toString();
  return fetchMerkl<MerklUserRewardsResponse>(`/users/${address}/rewards`, {
    query: {
      chainId: chainIdStr,
      claimableOnly: "true",
      // Using reloadChainId to avoid Merkl cache. Using it would break the
      // revalidation after claiming the rewards.
      reloadChainId: chainIdStr,
    },
  });
}

/**
 * Gets all the campaigns for a specific opportunity from the Merkl API.
 *
 * @param params - Configuration object
 * @param params.opportunityId - The ID of the opportunity
 * @returns The opportunity campaigns
 */
export const getOpportunityCampaigns = async ({
  opportunityId,
}: {
  opportunityId: string;
}) =>
  fetchMerkl<MerklOpportunityResponse>(
    `/opportunities/${opportunityId}/campaigns`,
  );

/**
 * Gets the live opportunities, with their campaigns, that target one of the
 * given addresses.
 *
 * @param params - Configuration object
 * @param params.chainIds - The chains to search
 * @param params.identifiers - The addresses the opportunities target
 * @returns The live opportunities
 */
export const getLiveOpportunities = ({
  chainIds,
  identifiers,
}: {
  chainIds: number[];
  identifiers: Address[];
}) =>
  fetchMerkl<MerklLiveOpportunity[]>("/opportunities", {
    query: {
      campaigns: "true",
      chainId: chainIds.join(","),
      identifier: identifiers.join(","),
      items: "100",
      status: "LIVE",
    },
  });
