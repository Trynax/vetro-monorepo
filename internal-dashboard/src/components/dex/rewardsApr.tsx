import { usePoolCampaigns } from "../../hooks/usePoolCampaigns";
import { useStakeDaoStrategy } from "../../hooks/useStakeDaoStrategy";
import { type RewardAprRow, rewardAprRows } from "../../lib/campaigns";
import { formatPercent } from "../../lib/format";
import { Tooltip } from "../tooltip";

import { CampaignSourceIcon } from "./campaignSourceIcon";

type Props = {
  className?: string;
  poolId: string;
};

const stakeDaoTooltip =
  "StakeDAO LP strategy APR (boosted gauge rewards, excl. fees). An alternative to staking in the Curve gauge directly, not added to Pool APY.";

const RewardLine = ({ row }: { row: RewardAprRow }) => (
  <span className="flex items-center gap-x-1">
    <CampaignSourceIcon size={14} source={row.source} />
    <span>{formatPercent(row.aprPercent)}</span>
    <span className="text-neutral-500">{row.tokenSymbols}</span>
  </span>
);

export const RewardsApr = function ({ className = "", poolId }: Props) {
  const campaignsQuery = usePoolCampaigns({ poolId });
  const strategyQuery = useStakeDaoStrategy({ poolId });

  const isLoading = [campaignsQuery, strategyQuery].some(
    (query) => query.data === undefined && !query.error,
  );
  if (isLoading) {
    return (
      <span className={`flex flex-col ${className}`}>
        <span className="h-5 w-16 animate-pulse rounded bg-neutral-100" />
      </span>
    );
  }

  // A failed source falls back to empty so the other one still renders.
  const rows = rewardAprRows({
    campaigns: campaignsQuery.data ?? [],
    stakeDaoStrategy: strategyQuery.data ?? null,
  });

  if (rows.length === 0) {
    const error = campaignsQuery.error ?? strategyQuery.error;
    return (
      <span className={`flex flex-col ${className}`}>
        {error ? (
          <Tooltip label={error.message}>
            <span className="text-neutral-400">—</span>
          </Tooltip>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </span>
    );
  }

  return (
    <span className={`flex flex-col gap-y-0.5 ${className}`}>
      {rows.map((row) =>
        row.source === "stakeDao" ? (
          <Tooltip key={`${row.source}-${row.id}`} label={stakeDaoTooltip}>
            <RewardLine row={row} />
          </Tooltip>
        ) : (
          <RewardLine key={`${row.source}-${row.id}`} row={row} />
        ),
      )}
    </span>
  );
};
