import {
  type UseQueryOptions,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";
import fetch from "fetch-plus-plus";

const apiUrl = import.meta.env.VITE_PORTAL_API_URL;

type Prices = Record<string, string>;

type QueryOptions<TSelect = Prices> = Omit<
  UseQueryOptions<Prices, Error, TSelect>,
  "queryKey" | "queryFn"
>;

const tokenPricesQueryKey = () => ["token-price"] as const;

export const tokenPricesOptions = <TSelect = Prices>(
  options: QueryOptions<TSelect> = {} as QueryOptions<TSelect>,
) =>
  queryOptions({
    enabled: apiUrl !== undefined && URL.canParse(apiUrl),
    queryFn: () =>
      fetch(`${apiUrl}/prices`).then(({ prices }) => prices as Prices),
    queryKey: tokenPricesQueryKey(),
    refetchInterval: 60 * 1000, // 1 minute
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });

export const useTokenPrices = <TSelect = Prices>(
  options: QueryOptions<TSelect> = {} as QueryOptions<TSelect>,
) => useQuery(tokenPricesOptions(options));
