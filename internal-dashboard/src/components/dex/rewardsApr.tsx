import { usePoolCampaigns } from "../../hooks/usePoolCampaigns";
import { useStakeDaoStrategy } from "../../hooks/useStakeDaoStrategy";
import { type RewardAprRow, rewardAprRows } from "../../lib/campaigns";
import { formatAprRange } from "../../lib/format";
import { type TrackedPool } from "../../lib/types";
import { Tooltip } from "../tooltip";

import { CampaignSourceIcon } from "./campaignSourceIcon";
import { TokenIcon } from "./tokenIcon";

type Align = "end" | "start";

type RewardsAprProps = {
  align: Align;
  pool: TrackedPool;
};

// Each line needs its own justify-* so wrapped content stays aligned with the column.
const alignClasses: Record<Align, { column: string; line: string }> = {
  end: { column: "items-end", line: "justify-end" },
  start: { column: "items-start", line: "justify-start" },
};

// CRV on Ethereum; only mainnet Curve pools are tracked.
const crvAddress = "0xD533a949740bb3306d119CC777fa900bA034cd52";

const tooltips: Partial<Record<RewardAprRow["source"], string>> = {
  curveGauge:
    "Curve gauge CRV emissions for LPs staked in the gauge: unboosted → max veCRV boost (2.5x).",
  stakeDao:
    "StakeDAO strategy: boosted CRV plus extra rewards, excl. fees. An alternative to the Curve gauge, not added to it.",
};

const RewardSourceIcon = ({ source }: { source: RewardAprRow["source"] }) =>
  source === "curveGauge" ? (
    <TokenIcon address={crvAddress} dex="curve" size={14} symbol="CRV" />
  ) : (
    <CampaignSourceIcon size={14} source={source} />
  );

const RewardLine = ({ align, row }: { align: Align; row: RewardAprRow }) => (
  <span
    className={`flex flex-wrap items-center gap-x-1 ${alignClasses[align].line}`}
  >
    <RewardSourceIcon source={row.source} />
    <span>
      {formatAprRange({
        max: row.aprPercentMax ?? row.aprPercent,
        min: row.aprPercent,
      })}
    </span>
    <span className="text-neutral-500">{row.tokenSymbols}</span>
  </span>
);

export const RewardsApr = function ({ align, pool }: RewardsAprProps) {
  const { column } = alignClasses[align];
  const campaignsQuery = usePoolCampaigns({ poolId: pool.id });
  const strategyQuery = useStakeDaoStrategy(pool.id);

  const isLoading = [campaignsQuery, strategyQuery].some(
    (query) => query.data === undefined && !query.error,
  );
  if (isLoading) {
    return (
      <span className={`flex flex-col ${column}`}>
        <span className="h-5 w-16 animate-pulse rounded bg-neutral-100" />
      </span>
    );
  }

  // A failed source falls back to empty so the remaining rows still render. The
  // StakeDAO strategy row also needs an active Votemarket campaign, so it hides
  // without campaigns data.
  const rows = rewardAprRows({
    campaigns: campaignsQuery.data ?? [],
    emission: pool,
    stakeDaoStrategy: strategyQuery.data ?? null,
  });

  if (rows.length === 0) {
    const error = campaignsQuery.error ?? strategyQuery.error;
    return (
      <span className={`flex flex-col ${column}`}>
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
    <span className={`flex flex-col gap-y-0.5 ${column}`}>
      {rows.map(function (row) {
        const key = `${row.source}-${row.id}`;
        const tooltip = tooltips[row.source];
        return tooltip ? (
          <Tooltip key={key} label={tooltip} multiline>
            <RewardLine align={align} row={row} />
          </Tooltip>
        ) : (
          <RewardLine align={align} key={key} row={row} />
        );
      })}
    </span>
  );
};
