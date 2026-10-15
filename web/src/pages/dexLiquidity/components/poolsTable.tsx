import { useWindowSize } from "@hemilabs/react-hooks/useWindowSize";
import type { DexPool } from "@vetro-protocol/core";
import { ButtonLink } from "components/base/button";
import { SectionHeader } from "components/base/sectionHeader";
import { Table, type TableColumnDef } from "components/base/table";
import { Header } from "components/base/table/header";
import { ChainLogo } from "components/chainLogo";
import { ExternalLinkIcon } from "components/icons/externalLinkIcon";
import { getChainById } from "networks";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import { screenBreakpoints } from "styles/breakpoints";
import { formatUsd } from "utils/currency";
import { formatPercentage } from "utils/format";

import { useDexPools } from "../hooks/useDexPools";
import { getDepositUrl, sortByTvl } from "../utils";

import { PoolName } from "./poolName";
import { RewardsAprLabel } from "./rewardsAprLabel";
import { RewardsList } from "./rewardsList";
import { EmptyState, ErrorState } from "./tableStates";

const emptyPools: DexPool[] = [];

const getPoolId = (pool: DexPool) => `${pool.chainId}-${pool.address}`;

const ChainName = function ({ chainId }: { chainId: number }) {
  const chain = getChainById(chainId);
  return (
    <span className="text-b-medium flex items-center gap-1.5 text-gray-900">
      <span aria-hidden="true">
        <ChainLogo chain={chain} size="large" />
      </span>
      {chain.name}
    </span>
  );
};

const Tvl = ({ pool }: { pool: DexPool }) => (
  <span className="text-b-medium text-gray-900 tabular-nums">
    {pool.tvlUsd === null ? "-" : formatUsd(pool.tvlUsd)}
  </span>
);

const PoolApr = ({ pool }: { pool: DexPool }) => (
  <span className="text-h5 text-gray-900 tabular-nums">
    {pool.apr === null ? "-" : formatPercentage(pool.apr)}
  </span>
);

const AddLiquidityLink = function ({ pool }: { pool: DexPool }) {
  const { t } = useTranslation();
  return (
    <ButtonLink href={getDepositUrl(pool)} size="xSmall" variant="primary">
      {t("pages.dex-liquidity.add-liquidity")}
      <ExternalLinkIcon />
    </ButtonLink>
  );
};

const PoolCard = function ({ pool }: { pool: DexPool }) {
  const { t } = useTranslation();
  return (
    <article className="flex flex-col gap-4 border-b border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <PoolName pool={pool} />
        <ChainName chainId={pool.chainId} />
      </div>
      <dl className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <dt className="text-b-regular text-gray-500">
            {t("pages.dex-liquidity.tvl")}
          </dt>
          <dd>
            <Tvl pool={pool} />
          </dd>
        </div>
        <div className="flex flex-col items-end">
          <dt className="text-b-regular text-gray-500">
            {t("pages.dex-liquidity.pool-apr")}
          </dt>
          <dd>
            <PoolApr pool={pool} />
          </dd>
        </div>
        <div className="col-span-2 flex flex-col gap-0.5">
          <dt className="text-b-regular text-gray-500">
            <RewardsAprLabel />
          </dt>
          <dd>
            <RewardsList pool={pool} />
          </dd>
        </div>
      </dl>
      <div>
        <AddLiquidityLink pool={pool} />
      </div>
    </article>
  );
};

const PoolCardSkeleton = () => (
  <div className="flex flex-col gap-4 border-b border-gray-200 bg-white p-4">
    <Skeleton height={28} width={160} />
    <Skeleton count={2} height={16} />
  </div>
);

export function PoolsTable() {
  const { t } = useTranslation();
  const {
    data = emptyPools,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useDexPools();
  const { width } = useWindowSize();

  const pools = useMemo(() => sortByTvl(data), [data]);

  const columns = useMemo(
    (): TableColumnDef<DexPool>[] => [
      {
        cell: ({ row }) => <PoolName pool={row.original} />,
        header: () => <Header text={t("pages.dex-liquidity.pool")} />,
        id: "pool",
        meta: { width: "220px" },
      },
      {
        cell: ({ row }) => <ChainName chainId={row.original.chainId} />,
        header: () => <Header text={t("pages.dex-liquidity.chain")} />,
        id: "chain",
        meta: { width: "110px" },
      },
      {
        cell: ({ row }) => <Tvl pool={row.original} />,
        header: () => <Header text={t("pages.dex-liquidity.tvl")} />,
        id: "tvl",
        meta: { className: "justify-end", width: "96px" },
      },
      {
        cell: ({ row }) => <PoolApr pool={row.original} />,
        header: () => <Header text={t("pages.dex-liquidity.pool-apr")} />,
        id: "pool-apr",
        meta: { className: "justify-end", width: "96px" },
      },
      {
        cell: ({ row }) => <RewardsList pool={row.original} />,
        header: () => (
          <Header>
            <RewardsAprLabel />
          </Header>
        ),
        id: "rewards-apr",
        meta: { className: "grow pl-10", width: "240px" },
      },
      {
        cell: ({ row }) => <AddLiquidityLink pool={row.original} />,
        header: () => <Header text="" />,
        id: "action",
        meta: { className: "justify-end", width: "130px" },
      },
    ],
    [t],
  );

  const placeholder = isError ? (
    <ErrorState isRetrying={isFetching} onRetry={() => refetch()} />
  ) : (
    <EmptyState />
  );
  return (
    <div className="border-t border-gray-200">
      <SectionHeader title={t("pages.dex-liquidity.pools")} />
      {width >= screenBreakpoints.md ? (
        <Table
          columns={columns}
          data={pools}
          getRowId={getPoolId}
          loading={isLoading}
          placeholder={placeholder}
        />
      ) : (
        <>
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <PoolCardSkeleton key={index} />
            ))}
          {!isLoading && pools.length === 0 && placeholder}
          {pools.map((pool) => (
            <PoolCard key={getPoolId(pool)} pool={pool} />
          ))}
        </>
      )}
    </div>
  );
}
