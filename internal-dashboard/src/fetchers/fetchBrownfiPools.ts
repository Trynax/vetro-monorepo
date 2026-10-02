import { knownTokens } from "@vetro-protocol/core";
import { getAddress, parseUnits } from "viem";
import { hemi } from "viem/chains";

import { brownfiPoolUrl } from "../config/brownfi";
import { type BrownfiPool, fetchVetroPools } from "../lib/brownfiApi";
import { poolTvlUsd } from "../lib/poolMetrics";
import { type PoolCoin, type TrackedPool } from "../lib/types";

const hour = 60 * 60;

// The 24 hourly buckets ending with the one in progress.
const rollingDayStart = (nowSeconds: number) =>
  (Math.floor(nowSeconds / hour) - 23) * hour;

const buildCoin = function ({
  balance,
  nativeUsdPrice,
  token,
}: {
  balance: string;
  nativeUsdPrice: number | undefined;
  token: BrownfiPool["token0"];
}): PoolCoin {
  const decimals = Number(token.decimals);
  const derived = Number(token.derivedMatic);
  return {
    address: getAddress(token.id),
    balance: parseUnits(balance, decimals),
    decimals,
    symbol: token.symbol,
    usdPrice:
      nativeUsdPrice !== undefined && derived > 0
        ? derived * nativeUsdPrice
        : undefined,
  };
};

const buildPool = function ({
  nativeUsdPrice,
  pool,
}: {
  nativeUsdPrice: number | undefined;
  pool: BrownfiPool;
}): TrackedPool {
  const coins = [
    buildCoin({
      balance: pool.totalValueLockedToken0,
      nativeUsdPrice,
      token: pool.token0,
    }),
    buildCoin({
      balance: pool.totalValueLockedToken1,
      nativeUsdPrice,
      token: pool.token1,
    }),
  ];

  const feesUsd24h = pool.poolHourData.reduce(
    (sum, bucket) => sum + Number(bucket.feesUSD),
    0,
  );
  const volumeUsd24h = pool.poolHourData.reduce(
    (sum, bucket) => sum + Number(bucket.volumeUSD),
    0,
  );

  // The subgraph publishes a TVL of its own, but it values only the legs it can
  // price; both legs are valued here instead, so the per-coin shares the details
  // page shows always add up to this total.
  const tvlUsd = poolTvlUsd(coins);
  const address = getAddress(pool.id);
  const feeHundredthsOfBip = Number(pool.overrideFee) || Number(pool.fee);

  return {
    address,
    baseApy:
      tvlUsd === undefined
        ? undefined
        : tvlUsd > 0
          ? ((feesUsd24h * 365) / tvlUsd) * 100
          : 0,
    chainId: hemi.id,
    coins,
    dex: "brownfi",
    emissionApy: 0,
    emissionApyMax: 0,
    feesUsd24h,
    gaugeAddress: undefined,
    id: address,
    lpTokenAddress: undefined,
    name: coins.map((coin) => coin.symbol).join("/"),
    poolType: `BrownFi CLAMM · ${feeHundredthsOfBip / 10_000}%`,
    tvlUsd,
    url: brownfiPoolUrl(address),
    virtualPrice: 0,
    volumeUsd24h,
  };
};

export const fetchBrownfiPools = async function (
  trackedSymbols: Set<string>,
): Promise<TrackedPool[]> {
  const tokenAddresses = knownTokens
    .filter(
      (token) => token.chainId === hemi.id && trackedSymbols.has(token.symbol),
    )
    .map((token) => token.address);
  if (tokenAddresses.length === 0) {
    return [];
  }

  const { nativeUsdPrice, pools } = await fetchVetroPools({
    sinceSeconds: rollingDayStart(Date.now() / 1000),
    tokenAddresses,
  });

  return pools.map((pool) => buildPool({ nativeUsdPrice, pool }));
};
