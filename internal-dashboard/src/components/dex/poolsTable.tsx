import { Link, useNavigate } from "react-router";

import { formatOptionalUsd, formatPoolApy, formatUsd } from "../../lib/format";
import { type TrackedPool } from "../../lib/types";

import { CampaignsBadge } from "./campaignsBadge";
import { ChainLogo } from "./chainLogo";
import { RangeBadge } from "./rangeBadge";
import { RewardsApr } from "./rewardsApr";
import { TokenPair } from "./tokenPair";
import { VenueBadge } from "./venueBadge";

type Props = {
  pools: TrackedPool[];
};

const poolPath = (pool: TrackedPool) => `/dex/${pool.id}`;

export const PoolsTable = function ({ pools }: Props) {
  const navigate = useNavigate();

  return (
    <>
      <ul className="flex flex-col gap-y-3 md:hidden">
        {pools.map((pool) => (
          <li key={pool.id}>
            <Link
              className="block rounded-lg border border-neutral-200 p-4 active:bg-neutral-50"
              to={poolPath(pool)}
            >
              <div className="flex items-center justify-between gap-x-2">
                <TokenPair {...pool} />
                <span className="flex shrink-0 items-center gap-x-1.5">
                  <ChainLogo chainId={pool.chainId} />
                  <CampaignsBadge poolId={pool.id} />
                  {pool.rangeLabel ? (
                    <RangeBadge label={pool.rangeLabel} />
                  ) : null}
                  <VenueBadge dex={pool.dex} />
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-neutral-500">TVL</dt>
                  <dd className="font-semibold text-neutral-950">
                    {formatOptionalUsd(pool.tvlUsd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">24h Volume</dt>
                  <dd className="font-semibold text-neutral-950">
                    {formatUsd(pool.volumeUsd24h)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Pool APY</dt>
                  <dd className="font-semibold text-neutral-950">
                    {formatPoolApy(pool)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Rewards APR</dt>
                  <dd className="font-semibold text-neutral-950">
                    <RewardsApr className="items-start" poolId={pool.id} />
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs font-medium text-neutral-500">
              <th className="py-2 pr-4 text-left font-medium">Chain</th>
              <th className="py-2 pr-4 text-left font-medium">Pool</th>
              <th className="py-2 pr-4 text-right font-medium">TVL</th>
              <th className="py-2 pr-4 text-right font-medium">24h Volume</th>
              <th className="py-2 pr-4 text-right font-medium">Pool APY</th>
              <th className="py-2 pr-4 text-right font-medium">Rewards APR</th>
              <th className="py-2 text-right font-medium">Campaigns</th>
            </tr>
          </thead>
          <tbody>
            {pools.map((pool) => (
              <tr
                className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50"
                key={pool.id}
                onClick={() => navigate(poolPath(pool))}
              >
                <td className="py-3 pr-4">
                  <ChainLogo chainId={pool.chainId} size={20} />
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-x-2">
                    <Link
                      className="hover:underline"
                      onClick={(event) => event.stopPropagation()}
                      to={poolPath(pool)}
                    >
                      <TokenPair {...pool} />
                    </Link>
                    {pool.rangeLabel ? (
                      <RangeBadge label={pool.rangeLabel} />
                    ) : null}
                    <VenueBadge dex={pool.dex} />
                  </div>
                </td>
                <td className="py-3 pr-4 text-right font-medium text-neutral-950">
                  {formatOptionalUsd(pool.tvlUsd)}
                </td>
                <td className="py-3 pr-4 text-right font-medium text-neutral-950">
                  {formatUsd(pool.volumeUsd24h)}
                </td>
                <td className="py-3 pr-4 text-right font-medium text-neutral-950">
                  {formatPoolApy(pool)}
                </td>
                <td className="py-3 pr-4 text-right font-medium text-neutral-950">
                  <RewardsApr className="items-end" poolId={pool.id} />
                </td>
                <td className="py-3 text-right">
                  <CampaignsBadge poolId={pool.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
