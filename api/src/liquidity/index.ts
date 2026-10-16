import { createMainnetClient, type DexPool } from "@vetro-protocol/core";

import { getBrownfiPools } from "./brownfi.ts";
import { getCurvePools } from "./curve.ts";
import { getSushiPools } from "./sushi.ts";
import { getUniswapPools } from "./uniswap.ts";

type VenueArgs = {
  nowSeconds: number;
  portalApiUrl: string;
  rpcUrl: string | undefined;
  subgraphApiKey: string | undefined;
};

const venuePools = {
  brownfi: ({ nowSeconds, subgraphApiKey }: VenueArgs) =>
    getBrownfiPools({ nowSeconds, subgraphApiKey }),
  curve: () => getCurvePools(),
  sushi: ({ nowSeconds, portalApiUrl, rpcUrl, subgraphApiKey }: VenueArgs) =>
    getSushiPools({
      client: createMainnetClient(rpcUrl),
      nowSeconds,
      portalApiUrl,
      subgraphApiKey,
    }),
  uniswap: ({ portalApiUrl, rpcUrl }: VenueArgs) =>
    getUniswapPools({ client: createMainnetClient(rpcUrl), portalApiUrl }),
} satisfies Record<string, (args: VenueArgs) => Promise<DexPool[]>>;

export const venues = Object.keys(venuePools) as (keyof typeof venuePools)[];

export const getVenuePools = ({
  venue,
  ...args
}: VenueArgs & { venue: keyof typeof venuePools }): Promise<DexPool[]> =>
  venuePools[venue](args);
