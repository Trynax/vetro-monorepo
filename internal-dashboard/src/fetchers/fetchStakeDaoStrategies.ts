import { type QueryClient } from "@tanstack/react-query";
import { type Address, isAddressEqual } from "viem";

import { trackedPoolsOptions } from "../hooks/useTrackedPools";
import { fetchStakeDaoStrategiesByGauge } from "../lib/stakeDaoApi";
import { type TrackedPool } from "../lib/types";

type GaugedPool = TrackedPool & { gaugeAddress: Address };

const isCurvePoolWithGauge = (pool: TrackedPool): pool is GaugedPool =>
  pool.dex === "curve" && pool.gaugeAddress !== undefined;

const fetchChainStrategies = async function ({
  chainId,
  pools,
}: {
  chainId: number;
  pools: GaugedPool[];
}) {
  const strategies = await fetchStakeDaoStrategiesByGauge({
    chainId,
    gauges: pools.map((pool) => pool.gaugeAddress),
  });
  return pools.flatMap(function (pool) {
    const strategy = strategies.find((candidate) =>
      isAddressEqual(candidate.gaugeAddress, pool.gaugeAddress),
    );
    return strategy ? [[pool.id, strategy] as const] : [];
  });
};

export const fetchStakeDaoStrategies = async function (
  queryClient: QueryClient,
) {
  const pools = await queryClient.ensureQueryData(trackedPoolsOptions());
  const gaugedPools = pools.filter(isCurvePoolWithGauge);
  const chainIds = [...new Set(gaugedPools.map((pool) => pool.chainId))];

  const entries = await Promise.all(
    chainIds.map((chainId) =>
      fetchChainStrategies({
        chainId,
        pools: gaugedPools.filter((pool) => pool.chainId === chainId),
      }),
    ),
  );
  return Object.fromEntries(entries.flat());
};
