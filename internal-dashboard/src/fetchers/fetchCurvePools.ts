import { getAddress } from "viem";
import { mainnet } from "viem/chains";

import { fetchAllPools, fetchVolumes } from "../lib/curveApi";
import { normalizeAddress } from "../lib/format";
import { type PoolCoin, type TrackedPool } from "../lib/types";

// The Curve implementation of a DEX pool source: fetches every Curve pool plus
// its volume, keeps the ones holding a tracked token, and maps them onto the
// venue-agnostic TrackedPool shape.
//
// The Curve API has no server-side filtering (no token/address/search query
// param — only network, registry, or coarse size buckets), so we have to load
// every pool and filter by tracked token client-side. Unfortunate, but it's the
// only way to reliably catch every pool holding a tracked token (size-bucket
// filtering would silently drop low-TVL pools).
export const fetchCurvePools = async function (
  trackedAddresses: Set<string>,
): Promise<TrackedPool[]> {
  const [pools, volumes] = await Promise.all([fetchAllPools(), fetchVolumes()]);

  const volumeByAddress = new Map(
    volumes.map((volume) => [volume.address.toLowerCase(), volume]),
  );

  return pools
    .filter((pool) =>
      pool.coins.some((coin) =>
        trackedAddresses.has(coin.address.toLowerCase()),
      ),
    )
    .map(function (pool): TrackedPool {
      const volume = volumeByAddress.get(pool.address.toLowerCase());

      const coins: PoolCoin[] = pool.coins.map((coin) => ({
        address: getAddress(coin.address),
        balance: BigInt(coin.poolBalance),
        decimals: Number(coin.decimals),
        symbol: coin.symbol,
        usdPrice: coin.usdPrice ?? undefined,
      }));

      const baseApy = volume?.latestDailyApyPcent ?? 0;
      const emissionApy = pool.gaugeCrvApy?.[0] ?? 0;
      const emissionApyMax = pool.gaugeCrvApy?.[1] ?? emissionApy;
      const address = getAddress(pool.address);

      return {
        address,
        baseApy,
        chainId: mainnet.id,
        coins,
        dex: "curve",
        emissionApy,
        emissionApyMax,
        gaugeAddress: normalizeAddress(pool.gaugeAddress),
        id: address,
        lpTokenAddress: pool.lpTokenAddress
          ? getAddress(pool.lpTokenAddress)
          : undefined,
        name: pool.name,
        poolType: pool.registryId,
        tvlUsd: pool.usdTotal,
        url: pool.poolUrls?.swap?.[0] ?? "",
        virtualPrice: Number(pool.virtualPrice) / 1e18,
        volumeUsd24h: volume?.volumeUSD ?? 0,
      };
    });
};
