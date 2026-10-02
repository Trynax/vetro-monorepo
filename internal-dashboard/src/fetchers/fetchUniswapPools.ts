import { type QueryClient } from "@tanstack/react-query";
import { type Address, parseUnits } from "viem";
import { mainnet } from "viem/chains";

import { trackedTokensOptions } from "../hooks/useTrackedTokens";
import { whitelistedTokensOptions } from "../hooks/useWhitelistedTokens";
import { poolTvlUsd } from "../lib/poolMetrics";
import { type PoolCoin, type TrackedPool } from "../lib/types";
import { fetchUniswapPoolData } from "../lib/uniswapApi";
import { buildPoolQueries, findPools, type PoolQuery } from "../lib/uniswapV3";

const fetchUniswapPool = async function (
  pool: PoolQuery & { address: Address },
): Promise<TrackedPool> {
  const data = await fetchUniswapPoolData(pool.address);

  const coins = [pool.token0, pool.token1].map(
    (token, index): PoolCoin => ({
      address: token.address,
      balance: parseUnits(
        data.supplies[index].toFixed(token.decimals),
        token.decimals,
      ),
      decimals: token.decimals,
      symbol: token.symbol,
      usdPrice: data.usdPrices[index],
    }),
  );

  // Uniswap's own TVL counts only the legs it can price, so it's the one figure
  // that can't be taken as published; both legs are valued here instead.
  const tvlUsd = poolTvlUsd(coins);
  // Uniswap publishes no fee figure, so it follows from the volume it does
  // publish: the tier is charged on every swap's input.
  const feesUsd24h = (data.volumeUsd24h * data.feeTier) / 1_000_000;

  return {
    address: pool.address,
    baseApy: tvlUsd ? ((feesUsd24h * 365) / tvlUsd) * 100 : 0,
    chainId: mainnet.id,
    coins,
    dex: "uniswap",
    emissionApy: 0,
    emissionApyMax: 0,
    feesUsd24h,
    gaugeAddress: undefined,
    id: pool.address,
    lpTokenAddress: undefined,
    name: coins.map((coin) => coin.symbol).join("/"),
    poolType: `Uniswap V3 · ${data.feeTier / 10_000}%`,
    tvlUsd,
    url: `https://app.uniswap.org/explore/pools/ethereum/${pool.address}`,
    virtualPrice: 0,
    volumeUsd24h: data.volumeUsd24h,
  };
};

export const fetchUniswapPools = async function (queryClient: QueryClient) {
  const [trackedTokens, whitelistedTokens] = await Promise.all([
    queryClient.ensureQueryData(trackedTokensOptions()),
    queryClient.ensureQueryData(whitelistedTokensOptions()),
  ]);

  const pools = await findPools(
    buildPoolQueries({
      candidates: [...trackedTokens, ...whitelistedTokens],
      trackedAddresses: new Set(
        trackedTokens.map((token) => token.address.toLowerCase()),
      ),
    }),
  );

  // Isolate per-pool failures so one pool Uniswap can't answer for doesn't drop
  // the whole Uniswap source.
  const results = await Promise.allSettled(pools.map(fetchUniswapPool));
  return results
    .filter(
      (result): result is PromiseFulfilledResult<TrackedPool> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
};
