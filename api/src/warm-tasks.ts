import type { DexPool } from "@vetro-protocol/core";
import { gatewayAddresses } from "@vetro-protocol/gateway";

import {
  getCollateralizationRatio,
  getStaked,
  getTreasuryComposition,
  getTvl,
} from "./analytics.ts";
import { convertBigIntsToString } from "./convert-bigints-to-string.ts";
import {
  getGaugedStrategies,
  getMerklRewards,
} from "./liquidity/incentives.ts";
import { getVenuePools, venues } from "./liquidity/index.ts";
import { getCampaignGauges } from "./liquidity/stake-dao.ts";
import { withTimeout } from "./utils/promises.ts";
import { getApy } from "./variable-stake.ts";
import { globalWarmTask, keyedWarmTask } from "./warm-cache.ts";

// Warms `GET /analytics/treasury/:gatewayAddress`
export const treasuryTask = keyedWarmTask({
  cron: "* * * * *",
  items: gatewayAddresses,
  key: (gatewayAddress) => `analytics:treasury:${gatewayAddress}`,
  produce: (env, gatewayAddress) =>
    getTreasuryComposition({
      gatewayAddress,
      url: env.CUSTOM_RPC_URL_MAINNET,
    }).then(convertBigIntsToString),
});

// Warms `GET /analytics/collateralization-ratio/:gatewayAddress`
export const collateralizationRatioTask = keyedWarmTask({
  cron: "*/5 * * * *",
  items: gatewayAddresses,
  key: (gatewayAddress) =>
    `analytics:collateralization-ratio:${gatewayAddress}`,
  produce: (env, gatewayAddress) =>
    getCollateralizationRatio({
      gatewayAddress,
      url: env.CUSTOM_RPC_URL_MAINNET,
    }).then(convertBigIntsToString),
});

// Warms `GET /analytics/tvl/:gatewayAddress`
export const tvlTask = keyedWarmTask({
  cron: "* * * * *",
  items: gatewayAddresses,
  key: (gatewayAddress) => `analytics:tvl:${gatewayAddress}`,
  produce: (env, gatewayAddress) =>
    getTvl({
      gatewayAddress,
      url: env.CUSTOM_RPC_URL_MAINNET,
    }).then(convertBigIntsToString),
});

// Warms `GET /analytics/staked/:gatewayAddress`
export const stakedTask = keyedWarmTask({
  cron: "* * * * *",
  items: gatewayAddresses,
  key: (gatewayAddress) => `analytics:staked:${gatewayAddress}`,
  produce: (env, gatewayAddress) =>
    getStaked({
      gatewayAddress,
      url: env.CUSTOM_RPC_URL_MAINNET,
    }).then(convertBigIntsToString),
});

// Warms `GET /variable-stake/apy` — a single global key, so no `items`.
export const apyTask = globalWarmTask({
  cron: "* * * * *",
  key: () => "variable-stake:apy",
  // getApy omits vaults whose reads fail and returns `{}` only on a total outage.
  // Mapping that to null makes `warmScheduled` treat it as a failure: it reports to
  // Sentry and keeps the last-known-good KV value rather than clobbering it with `{}`.
  produce: (env) =>
    getApy({ rpcUrl: env.CUSTOM_RPC_URL_MAINNET }).then((data) =>
      Object.keys(data).length > 0 ? data : null,
    ),
});

const nowSeconds = () => Math.floor(Date.now() / 1000);

export const liquidityVenuePoolsTask = keyedWarmTask({
  cron: "*/5 * * * *",
  items: venues,
  key: (venue) => `liquidity:pools:${venue}`,
  produce: (env, venue) =>
    withTimeout(
      getVenuePools({
        nowSeconds: nowSeconds(),
        portalApiUrl: env.PORTAL_API_URL,
        rpcUrl: env.CUSTOM_RPC_URL_MAINNET,
        subgraphApiKey: env.SUBGRAPH_API_KEY,
        venue,
      }),
    ),
});

export const liquidityCampaignGaugesTask = globalWarmTask({
  cron: "*/5 * * * *",
  key: () => "liquidity:campaign-gauges",
  produce: () => withTimeout(getCampaignGauges(nowSeconds())),
});

export const liquidityMerklRewardsTask = globalWarmTask({
  cron: "*/5 * * * *",
  key: () => "liquidity:merkl-rewards",
  async produce(env) {
    const cached = await Promise.all(
      venues.map((venue) =>
        env.CACHE_KV.get<DexPool[]>(liquidityVenuePoolsTask.key(venue), "json"),
      ),
    );
    const pools = cached.filter((venuePools) => venuePools !== null).flat();
    if (pools.length === 0) {
      throw new Error("No cached DEX pools to read Merkl rewards for");
    }
    return withTimeout(getMerklRewards({ nowSeconds: nowSeconds(), pools }));
  },
});

export const liquidityStrategiesTask = globalWarmTask({
  cron: "*/5 * * * *",
  key: () => "liquidity:strategies",
  produce: () => withTimeout(getGaugedStrategies()),
});

export const warmTasks = [
  treasuryTask,
  collateralizationRatioTask,
  tvlTask,
  stakedTask,
  apyTask,
  liquidityVenuePoolsTask,
  liquidityCampaignGaugesTask,
  liquidityMerklRewardsTask,
  liquidityStrategiesTask,
];
