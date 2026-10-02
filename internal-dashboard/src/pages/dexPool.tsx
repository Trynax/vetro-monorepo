import { Link, useParams } from "react-router";
import { type Address, formatUnits, isAddressEqual } from "viem";

import { CampaignsList } from "../components/dex/campaignsList";
import { ChainLogo } from "../components/dex/chainLogo";
import { ExplorerLink } from "../components/dex/explorerLink";
import { ExternalLink } from "../components/dex/externalLink";
import { RangeBadge } from "../components/dex/rangeBadge";
import { StatCard } from "../components/dex/statCard";
import { StateMessage } from "../components/dex/stateMessage";
import { TokenIcon } from "../components/dex/tokenIcon";
import { TokenPair } from "../components/dex/tokenPair";
import { VenueBadge } from "../components/dex/venueBadge";
import { type Dex, dexLabels } from "../config/dexes";
import { useCurvePoolStats } from "../hooks/useCurvePoolStats";
import { useGaugeEmissions } from "../hooks/useGaugeEmissions";
import { useStakeDaoStrategyKey } from "../hooks/useStakeDaoStrategyKey";
import { useTrackedPools } from "../hooks/useTrackedPools";
import {
  formatOptionalPercent,
  formatOptionalUsd,
  formatPercent,
  formatPrice,
  formatRate,
  formatTokenAmount,
  formatUsd,
} from "../lib/format";
import { strategyUrl } from "../lib/stakeDaoApi";
import { type PoolCoin, type TrackedPool } from "../lib/types";

// Within 10% of equal value: treat the pair as a peg and surface drift from 1.
const PEG_THRESHOLD = 1.1;

// Curve's fees aren't on the pool object; fetch them per pool on demand.
const CurveFeesCard = function ({ pool }: { pool: TrackedPool }) {
  const { data: stats } = useCurvePoolStats({ poolAddress: pool.address });

  return (
    <StatCard
      hint={
        stats && stats.liquidityFee24h !== null && stats.liquidityFee24h > 0
          ? `+ ${formatPrice(stats.liquidityFee24h)} liquidity fees`
          : undefined
      }
      label="24h Fees"
      value={
        stats?.tradingFee24h !== undefined && stats.tradingFee24h !== null
          ? formatPrice(stats.tradingFee24h)
          : "—"
      }
    />
  );
};

// Rolling-24h fees. Sushi's API gives them on the pool object directly; Curve
// needs a separate per-pool analytics fetch.
const FeesCard = function ({ pool }: { pool: TrackedPool }) {
  if (pool.feesUsd24h !== null && pool.feesUsd24h !== undefined) {
    return <StatCard label="24h Fees" value={formatPrice(pool.feesUsd24h)} />;
  }
  return <CurveFeesCard pool={pool} />;
};

const ExchangeRateCard = function ({ pool }: { pool: TrackedPool }) {
  if (pool.coins.length !== 2) {
    return null;
  }
  const [base, quote] = pool.coins;
  // Without a price for both legs the rate is Infinity/NaN; skip the card.
  if (!base.usdPrice || !quote.usdPrice) {
    return null;
  }
  const rate = base.usdPrice / quote.usdPrice;
  const isPeg = Math.max(rate, 1 / rate) < PEG_THRESHOLD;
  const deviation = (rate - 1) * 100;

  return (
    <StatCard
      hint={
        isPeg ? (
          <span
            className={
              Math.abs(deviation) >= 0.5 ? "text-amber-600" : "text-emerald-600"
            }
          >
            {deviation >= 0 ? "+" : ""}
            {deviation.toFixed(3)}% vs. peg
          </span>
        ) : (
          `1 ${quote.symbol} = ${formatRate(1 / rate)} ${base.symbol}`
        )
      }
      label="Exchange rate"
      value={`1 ${base.symbol} = ${formatRate(rate)} ${quote.symbol}`}
    />
  );
};

const CoinBreakdown = function ({
  coin,
  dex,
  tvlUsd,
}: {
  coin: PoolCoin;
  dex: Dex;
  tvlUsd: number | undefined;
}) {
  const balance = Number(formatUnits(coin.balance, coin.decimals));
  const balanceUsd =
    coin.usdPrice === undefined ? undefined : balance * coin.usdPrice;
  const share =
    balanceUsd !== undefined && tvlUsd
      ? (balanceUsd / tvlUsd) * 100
      : undefined;

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center gap-x-2">
        <TokenIcon address={coin.address} dex={dex} symbol={coin.symbol} />
        <span className="font-medium text-neutral-950">{coin.symbol}</span>
        <span className="ml-auto text-xs text-neutral-500">
          {formatOptionalPercent(share)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">Balance</dt>
          <dd className="font-medium text-neutral-950">
            {formatTokenAmount(balance)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Value</dt>
          <dd className="font-medium text-neutral-950">
            {formatOptionalUsd(balanceUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Price</dt>
          <dd className="font-medium text-neutral-950">
            {coin.usdPrice === undefined ? "—" : formatPrice(coin.usdPrice)}
          </dd>
        </div>
      </dl>
    </div>
  );
};

const GaugeSection = function ({ pool }: { pool: TrackedPool }) {
  const { data: emission } = useGaugeEmissions({ poolAddress: pool.address });

  if (!pool.gaugeAddress) {
    return <p className="text-sm text-neutral-600">This pool has no gauge.</p>;
  }

  const hasEmissions = emission ? emission.estCrvPerDay > 0 : false;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard
        hint="Share of CRV emissions"
        label="Gauge weight"
        value={emission ? formatPercent(emission.relativeWeight * 100) : "—"}
      />
      <StatCard
        label="Est. CRV / day"
        value={emission ? formatTokenAmount(emission.estCrvPerDay) : "—"}
      />
      <StatCard
        label="CRV APY"
        value={
          pool.emissionApyMax > pool.emissionApy
            ? `${formatPercent(pool.emissionApy)} – ${formatPercent(pool.emissionApyMax)}`
            : formatPercent(pool.emissionApy)
        }
      />
      {!hasEmissions && emission ? (
        <p className="col-span-full text-xs text-neutral-500">
          No active CRV emissions are currently directed to this gauge.
        </p>
      ) : null}
    </div>
  );
};

const AddressRow = ({
  address,
  chainId,
  label,
}: {
  address: Address;
  chainId: number;
  label: string;
}) => (
  <div className="flex items-center justify-between gap-x-4 py-2 text-sm">
    <span className="text-neutral-600">{label}</span>
    <ExplorerLink address={address} chainId={chainId} />
  </div>
);

const GaugeRow = function ({
  chainId,
  gauge,
}: {
  chainId: number;
  gauge: Address;
}) {
  const { data: strategyKey } = useStakeDaoStrategyKey({ chainId, gauge });

  return (
    <div className="flex items-center justify-between gap-x-4 py-2 text-sm">
      <span className="text-neutral-600">Gauge</span>
      <span className="flex items-center gap-x-3">
        <ExplorerLink address={gauge} chainId={chainId} />
        {strategyKey ? (
          <ExternalLink
            className="font-medium text-blue-600 hover:underline"
            href={strategyUrl(strategyKey)}
          >
            Deposit LP on StakeDAO ↗
          </ExternalLink>
        ) : null}
      </span>
    </div>
  );
};

const AddressesSection = ({ pool }: { pool: TrackedPool }) => (
  <div>
    <h3 className="mb-1 text-lg font-semibold text-neutral-950">Addresses</h3>
    <div className="divide-y divide-neutral-100">
      <div className="flex items-center justify-between gap-x-4 py-2 text-sm">
        <span className="text-neutral-600">Pool</span>
        <span className="flex items-center gap-x-3">
          <ExplorerLink address={pool.address} chainId={pool.chainId} />
          {pool.url ? (
            <ExternalLink
              className="font-medium text-blue-600 hover:underline"
              href={pool.url}
            >
              {dexLabels[pool.dex]} ↗
            </ExternalLink>
          ) : null}
        </span>
      </div>
      {pool.gaugeAddress ? (
        <GaugeRow chainId={pool.chainId} gauge={pool.gaugeAddress} />
      ) : null}
      {pool.lpTokenAddress &&
      !isAddressEqual(pool.lpTokenAddress, pool.address) ? (
        <AddressRow
          address={pool.lpTokenAddress}
          chainId={pool.chainId}
          label="LP token"
        />
      ) : null}
      {pool.coins.map((coin) => (
        <AddressRow
          address={coin.address}
          chainId={pool.chainId}
          key={coin.address}
          label={coin.symbol}
        />
      ))}
    </div>
  </div>
);

export const DexPoolPage = function () {
  const { poolId } = useParams();
  const { data: pools, isError, isPending } = useTrackedPools();

  if (isPending) {
    return <StateMessage>Loading pool…</StateMessage>;
  }
  if (isError) {
    return (
      <StateMessage>
        Couldn&apos;t load pool data. Try again later.
      </StateMessage>
    );
  }

  const pool = pools?.find(
    (candidate) => candidate.id.toLowerCase() === poolId?.toLowerCase(),
  );

  if (!pool) {
    return (
      <section className="flex flex-col gap-y-4">
        <StateMessage>Pool not found.</StateMessage>
        <Link
          className="mx-auto text-sm text-blue-600 hover:underline"
          to="/dex"
        >
          ← Back to DEX
        </Link>
      </section>
    );
  }

  // The gauge section stays Curve-only — Sushi has no gauge.
  const isCurve = pool.dex === "curve";

  return (
    <section className="flex flex-col gap-y-8">
      <div className="flex flex-col gap-y-4">
        <Link className="text-sm text-blue-600 hover:underline" to="/dex">
          ← Back to DEX
        </Link>
        <div className="flex flex-col gap-y-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-x-2">
              <TokenPair
                coins={pool.coins}
                dex={pool.dex}
                name={pool.name}
                size={32}
              />
              <ChainLogo chainId={pool.chainId} size={20} />
              <VenueBadge dex={pool.dex} />
              {pool.rangeLabel ? <RangeBadge label={pool.rangeLabel} /> : null}
            </div>
            <p className="mt-1 text-xs text-neutral-500">{pool.poolType}</p>
          </div>
          {pool.url ? (
            <ExternalLink
              className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              href={pool.url}
            >
              View on {dexLabels[pool.dex]} ↗
            </ExternalLink>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="TVL" value={formatOptionalUsd(pool.tvlUsd)} />
        <StatCard label="24h Volume" value={formatUsd(pool.volumeUsd24h)} />
        <FeesCard pool={pool} />
        <StatCard
          hint={`${formatOptionalPercent(pool.baseApy)} base + ${formatPercent(pool.emissionApy)} rewards`}
          label="APY"
          value={formatOptionalPercent(
            pool.baseApy === undefined
              ? undefined
              : pool.baseApy + pool.emissionApy,
          )}
        />
        <StatCard
          hint="24h volume / TVL"
          label="Liquidity utilization"
          value={
            pool.tvlUsd
              ? formatPercent((pool.volumeUsd24h / pool.tvlUsd) * 100)
              : "—"
          }
        />
        <ExchangeRateCard pool={pool} />
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold text-neutral-950">
          Liquidity
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pool.coins.map((coin) => (
            <CoinBreakdown
              coin={coin}
              dex={pool.dex}
              key={coin.address}
              tvlUsd={pool.tvlUsd}
            />
          ))}
        </div>
      </div>

      {isCurve ? (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-neutral-950">Gauge</h3>
          <GaugeSection pool={pool} />
        </div>
      ) : null}

      <div>
        <h3 className="mb-1 text-lg font-semibold text-neutral-950">
          Reward campaigns
        </h3>
        <p className="mb-3 text-sm text-neutral-600">
          Third-party campaigns running on this pool.
        </p>
        <CampaignsList poolId={pool.id} />
      </div>

      <AddressesSection pool={pool} />
    </section>
  );
};
