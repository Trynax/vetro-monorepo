import { type ReactNode } from "react";

import {
  type CampaignSource,
  campaignSourceLabels,
} from "../../config/campaignSources";
import { usePoolCampaigns } from "../../hooks/usePoolCampaigns";
import { useStakeDaoStrategy } from "../../hooks/useStakeDaoStrategy";
import { endingSoonTooltip, endsSoon } from "../../lib/campaigns";
import {
  formatDuration,
  formatPercent,
  formatPrice,
  formatUsd,
} from "../../lib/format";
import { strategyUrl } from "../../lib/stakeDaoApi";
import {
  type MerklPoolCampaign,
  type PoolCampaign,
  type StakeDaoPoolCampaign,
} from "../../lib/types";
import { CircleWarningIcon } from "../icons/circleWarningIcon";
import { Tooltip } from "../tooltip";

import { CampaignSourceBadge } from "./campaignSourceBadge";
import { CopyButton } from "./copyButton";
import { ExternalLink } from "./externalLink";

const Metric = ({
  hint,
  label,
  value,
}: {
  hint?: ReactNode;
  label: string;
  value: string;
}) => (
  <div>
    <dt className="text-xs text-neutral-500">{label}</dt>
    <dd className="font-medium text-neutral-950">{value}</dd>
    {hint ? <dd className="text-xs">{hint}</dd> : null}
  </div>
);

const TimeLeftMetric = ({ secondsLeft }: { secondsLeft: number }) => (
  <Metric
    hint={
      endsSoon(secondsLeft) ? (
        <Tooltip label={endingSoonTooltip}>
          <span className="flex items-center gap-x-1 text-amber-600">
            <CircleWarningIcon size={20} />
            Ending soon
          </span>
        </Tooltip>
      ) : undefined
    }
    label="Time left"
    value={formatDuration(secondsLeft)}
  />
);

const CampaignHeader = ({
  link,
  source,
  subtitle,
  title,
}: {
  link: { label: string; url: string } | undefined;
  source: CampaignSource;
  subtitle: string;
  title: string;
}) => (
  <div className="flex items-start justify-between gap-x-3">
    <div className="min-w-0">
      <p className="font-medium text-neutral-950">{title}</p>
      <p className="truncate text-xs text-neutral-500">{subtitle}</p>
    </div>
    <span className="flex shrink-0 items-center gap-x-1.5">
      <CampaignSourceBadge source={source} />
      {link ? (
        <>
          <ExternalLink
            className="text-sm font-medium text-blue-600 hover:underline"
            href={link.url}
          >
            {link.label} ↗
          </ExternalLink>
          <CopyButton text={link.url} />
        </>
      ) : null}
    </span>
  </div>
);

const MerklCampaignCard = ({
  campaign,
  nowSeconds,
}: {
  campaign: MerklPoolCampaign;
  nowSeconds: number;
}) => (
  <div className="rounded-lg border border-neutral-200 p-4">
    <CampaignHeader
      link={{
        label: campaignSourceLabels[campaign.source],
        url: campaign.url,
      }}
      source={campaign.source}
      subtitle={campaign.name}
      title={`${campaign.rewardTokenSymbol} rewards`}
    />
    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <Metric
        hint={
          campaign.protocolAprPercent ? (
            <span className="text-neutral-500">
              + {formatPercent(campaign.protocolAprPercent)} protocol
            </span>
          ) : undefined
        }
        label="APR"
        value={formatPercent(campaign.aprPercent)}
      />
      <Metric label="TVL" value={formatUsd(campaign.tvlUsd)} />
      <Metric
        label="Daily rewards"
        value={formatPrice(campaign.dailyRewardsUsd)}
      />
      <TimeLeftMetric secondsLeft={campaign.endTimestamp - nowSeconds} />
    </dl>
  </div>
);

const StakeDaoCampaignCard = function ({
  campaign,
  nowSeconds,
  poolId,
}: {
  campaign: StakeDaoPoolCampaign;
  nowSeconds: number;
  poolId: string;
}) {
  const { data: strategy } = useStakeDaoStrategy({ poolId });
  const strategyKey = strategy?.key;

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <CampaignHeader
        link={
          strategyKey
            ? {
                label: `Deposit LP on ${campaignSourceLabels[campaign.source]}`,
                url: strategyUrl(strategyKey),
              }
            : undefined
        }
        source={campaign.source}
        subtitle={`Votemarket campaign ${campaign.campaignNumber} · paid to veCRV voters`}
        title={`${campaign.rewardTokenSymbol} vote incentives`}
      />
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Metric
          label="Total budget"
          value={formatUsd(campaign.totalRewardUsd)}
        />
        <Metric
          label="Weekly rewards"
          value={formatPrice(campaign.weeklyRewardUsd)}
        />
        <Metric
          label="Per vote"
          value={
            campaign.usdPerVote > 0 ? formatPrice(campaign.usdPerVote) : "—"
          }
        />
        <TimeLeftMetric secondsLeft={campaign.endTimestamp - nowSeconds} />
      </dl>
    </div>
  );
};

const CampaignCard = ({
  campaign,
  nowSeconds,
  poolId,
}: {
  campaign: PoolCampaign;
  nowSeconds: number;
  poolId: string;
}) =>
  campaign.source === "merkl" ? (
    <MerklCampaignCard campaign={campaign} nowSeconds={nowSeconds} />
  ) : (
    <StakeDaoCampaignCard
      campaign={campaign}
      nowSeconds={nowSeconds}
      poolId={poolId}
    />
  );

export const CampaignsList = function ({ poolId }: { poolId: string }) {
  const {
    data: campaigns,
    dataUpdatedAt,
    isError,
  } = usePoolCampaigns({ poolId });

  if (campaigns) {
    return campaigns.length === 0 ? (
      <p className="text-sm text-neutral-600">
        No reward campaigns are running on this pool.
      </p>
    ) : (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {campaigns.map((campaign) => (
          <CampaignCard
            campaign={campaign}
            key={`${campaign.source}-${campaign.id}`}
            nowSeconds={dataUpdatedAt / 1000}
            poolId={poolId}
          />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-neutral-600">
        Couldn&apos;t load campaign data. Try again later.
      </p>
    );
  }

  return <p className="text-sm text-neutral-600">Loading campaigns…</p>;
};
