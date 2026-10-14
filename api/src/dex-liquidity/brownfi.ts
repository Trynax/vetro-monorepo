import { knownTokens, type DexPool } from "@vetro-protocol/core";
import { type Address, checksumAddress, isAddressEqual } from "viem";
import { hemi, mainnet } from "viem/chains";

import { theGraphUrl } from "../env.ts";
import { runQuery } from "../graphql.ts";

import { feeApr, poolTvlUsd } from "./pool-metrics.ts";
import { trackedTokenAddresses } from "./tracked-tokens.ts";

const trackedSymbols = knownTokens
  .filter(
    (token) =>
      token.chainId === mainnet.id &&
      trackedTokenAddresses.some((address) =>
        isAddressEqual(address, token.address),
      ),
  )
  .map((token) => token.symbol);

const hemiTrackedTokenAddresses = knownTokens
  .filter(
    (token) =>
      token.chainId === hemi.id && trackedSymbols.includes(token.symbol),
  )
  .map((token) => token.address);

const brownfiSubgraphId = "D1UwhrB45geUZTNQ2QwrXwGEhk69iBESApJJzz378ZeS";

const poolsQuery = `
  query VetroPools($since: Int!, $tokens: [String!]!) {
    bundles(first: 1) {
      maticPriceUSD
    }
    pools(
      orderBy: totalValueLockedUSD
      orderDirection: desc
      where: { or: [{ token0_in: $tokens }, { token1_in: $tokens }] }
    ) {
      fee
      id
      overrideFee
      poolHourData(
        first: 24
        orderBy: periodStartUnix
        orderDirection: desc
        where: { periodStartUnix_gte: $since }
      ) {
        feesUSD
        volumeUSD
      }
      token0 { derivedMatic id }
      token1 { derivedMatic id }
      totalValueLockedToken0
      totalValueLockedToken1
    }
  }
`;

type RawToken = {
  // The token price in the native token of the chain.
  derivedMatic: string;
  id: Address;
};

type BrownfiPool = {
  fee: string;
  id: Address;
  overrideFee: string;
  poolHourData: { feesUSD: string; volumeUSD: string }[];
  token0: RawToken;
  token1: RawToken;
  totalValueLockedToken0: string;
  totalValueLockedToken1: string;
};

const hour = 60 * 60;

const rollingDayStart = (nowSeconds: number) =>
  (Math.floor(nowSeconds / hour) - 23) * hour;

const sum = (values: string[]) =>
  values.reduce((total, value) => total + Number(value), 0);

const buildPool = function ({
  nativeUsdPrice,
  pool,
}: {
  nativeUsdPrice: number | undefined;
  pool: BrownfiPool;
}): DexPool {
  const coins = [
    { amount: pool.totalValueLockedToken0, token: pool.token0 },
    { amount: pool.totalValueLockedToken1, token: pool.token1 },
  ].map(function ({ amount, token }) {
    const derived = Number(token.derivedMatic);
    return {
      address: checksumAddress(token.id),
      amount: Number(amount),
      usdPrice:
        nativeUsdPrice !== undefined && derived > 0
          ? derived * nativeUsdPrice
          : undefined,
    };
  });
  const tvlUsd = poolTvlUsd(coins);
  return {
    address: checksumAddress(pool.id),
    apr: feeApr({
      feesUsd24h: sum(pool.poolHourData.map((bucket) => bucket.feesUSD)),
      tvlUsd,
    }),
    chainId: hemi.id,
    coins: coins.map(({ address, amount }) => ({ address, amount })),
    dex: "brownfi",
    dexMetadata: {
      fee: Number(pool.fee),
      overrideFee: Number(pool.overrideFee),
    },
    rewards: [],
    tvlUsd,
    volumeUsd24h: sum(pool.poolHourData.map((bucket) => bucket.volumeUSD)),
  };
};

export async function getBrownfiPools({
  nowSeconds,
  subgraphApiKey,
}: {
  nowSeconds: number;
  subgraphApiKey: string | undefined;
}) {
  const data = await runQuery<{
    bundles: { maticPriceUSD: string }[];
    pools: BrownfiPool[];
  }>({
    query: poolsQuery,
    url: theGraphUrl({ apiKey: subgraphApiKey, subgraphId: brownfiSubgraphId }),
    variables: {
      since: rollingDayStart(nowSeconds),
      tokens: hemiTrackedTokenAddresses.map((address) => address.toLowerCase()),
    },
  });
  const nativeUsdPrice = Number(data.bundles[0]?.maticPriceUSD);
  return data.pools.map((pool) =>
    buildPool({
      nativeUsdPrice: nativeUsdPrice > 0 ? nativeUsdPrice : undefined,
      pool,
    }),
  );
}
