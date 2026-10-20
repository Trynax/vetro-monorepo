import { queryOptions, useQuery } from "@tanstack/react-query";

import { fetchStakeDaoStrategies } from "../fetchers/fetchStakeDaoStrategies";

const stakeDaoStrategiesOptions = () =>
  queryOptions({
    queryFn: ({ client: queryClient }) => fetchStakeDaoStrategies(queryClient),
    queryKey: ["stake-dao-strategies"],
    // Matches the worker's stakeDaoCacheSeconds; refetching sooner hits the same cached response
    refetchInterval: 3 * 60 * 1000,
    staleTime: 3 * 60 * 1000,
  });

export const useStakeDaoStrategy = (poolId: string) =>
  useQuery({
    ...stakeDaoStrategiesOptions(),
    select: (strategies) => strategies[poolId] ?? null,
  });
