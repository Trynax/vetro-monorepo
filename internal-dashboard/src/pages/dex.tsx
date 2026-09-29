import { useState } from "react";

import { PoolFilters } from "../components/dex/poolFilters";
import { PoolsTable } from "../components/dex/poolsTable";
import { StatCard } from "../components/dex/statCard";
import { StateMessage } from "../components/dex/stateMessage";
import { TokenDistribution } from "../components/dex/tokenDistribution";
import { CircleWarningIcon } from "../components/icons/circleWarningIcon";
import { Tooltip } from "../components/tooltip";
import { useCampaignPoolIds } from "../hooks/usePoolCampaigns";
import { useTrackedPools } from "../hooks/useTrackedPools";
import { useTrackedTokens } from "../hooks/useTrackedTokens";
import { useWhitelistedTokens } from "../hooks/useWhitelistedTokens";
import { formatUsd } from "../lib/format";
import {
  chainFilterOptions,
  emptyPoolFilters,
  filterPools,
  tokenFilterOptions,
  trackedSymbolOptions,
} from "../lib/poolFilters";
import { summarizeDexTvl } from "../lib/poolMetrics";
import { type TrackedPool } from "../lib/types";

const TotalTvlCard = function ({
  pools,
}: {
  pools: TrackedPool[] | undefined;
}) {
  if (!pools || pools.length === 0) {
    return null;
  }
  const { poolCount, totalTvlUsd, unpricedPoolCount } = summarizeDexTvl(pools);
  return (
    <div className="sm:min-w-48">
      <StatCard
        hint={`${poolCount} ${poolCount === 1 ? "pool" : "pools"}`}
        label="Total DEX TVL"
        value={
          unpricedPoolCount > 0 ? (
            // The icon goes at the card's right edge because the tooltip opens
            // to the left, which keeps it on screen on narrow viewports.
            <span className="flex items-center justify-between gap-x-2">
              <span>{formatUsd(totalTvlUsd)}</span>
              <Tooltip label="Some pools may be missing a USD price">
                <CircleWarningIcon size={20} />
              </Tooltip>
            </span>
          ) : (
            formatUsd(totalTvlUsd)
          )
        }
      />
    </div>
  );
};

export const DexPage = function () {
  const { data: pools, isError, isPending } = useTrackedPools();
  const { data: trackedTokens, error: trackedTokensError } = useTrackedTokens();
  const { data: whitelistedTokens, error: whitelistedTokensError } =
    useWhitelistedTokens();
  const { data: campaignPoolIds, error: campaignsError } = useCampaignPoolIds();
  const [filters, setFilters] = useState(emptyPoolFilters);

  const filtersError = [
    trackedTokensError,
    whitelistedTokensError,
    campaignsError,
  ].find(Boolean);

  const filteredPools = filterPools({
    campaignPoolIds: campaignPoolIds ?? [],
    filters,
    pools: pools ?? [],
  }).sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));

  return (
    <section className="flex flex-col gap-y-10">
      <header className="flex flex-col gap-y-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-950">DEX</h2>
          <p className="mt-1 text-sm font-medium text-neutral-600">
            DEX liquidity across tracked Vetro pools.
          </p>
        </div>
        <TotalTvlCard pools={pools} />
      </header>

      {isPending ? <StateMessage>Loading pools…</StateMessage> : null}
      {isError ? (
        <StateMessage>
          Couldn&apos;t load pool data. Try again later.
        </StateMessage>
      ) : null}

      {pools ? (
        pools.length === 0 ? (
          <StateMessage>No tracked pools found.</StateMessage>
        ) : (
          <>
            <div>
              <h3 className="mb-3 text-lg font-semibold text-neutral-950">
                Pools
              </h3>
              <PoolFilters
                campaignsDisabled={campaignPoolIds === undefined}
                chainOptions={chainFilterOptions(pools)}
                error={filtersError}
                filters={filters}
                onChange={setFilters}
                trackedSymbolOptions={trackedSymbolOptions({
                  pools,
                  tokens: trackedTokens ?? [],
                })}
                whitelistedTokenOptions={tokenFilterOptions({
                  pools,
                  tokens: whitelistedTokens ?? [],
                })}
              />
              {filteredPools.length === 0 ? (
                <StateMessage>No pool matches the filters.</StateMessage>
              ) : (
                <PoolsTable pools={filteredPools} />
              )}
            </div>
            <div>
              <h3 className="mb-1 text-lg font-semibold text-neutral-950">
                Stats
              </h3>
              <p className="mb-4 text-sm text-neutral-600">
                Share of each token&apos;s tracked liquidity by pool.
              </p>
              <TokenDistribution
                // Exclude concentrated range views so a pool's liquidity isn't
                // counted twice (the full entry already covers it).
                pools={pools.filter((pool) => !pool.isRangeView)}
              />
            </div>
          </>
        )
      ) : null}
    </section>
  );
};
