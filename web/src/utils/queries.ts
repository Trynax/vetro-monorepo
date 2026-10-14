import type { UseQueryResult } from "@tanstack/react-query";

export type QueryState<T = unknown> = Pick<
  UseQueryResult<T>,
  "data" | "isError" | "isLoading" | "isPending"
>;

type QueriesData<Results extends readonly QueryState[]> = {
  -readonly [K in keyof Results]: Exclude<Results[K]["data"], undefined>;
};

export function combineQueryResults<
  const Results extends readonly QueryState[],
  T,
>({
  results,
  select,
}: {
  results: Results;
  select: (data: QueriesData<Results>) => T;
}) {
  const isError = results.some((result) => result.isError);

  return {
    data: results.every((result) => result.data !== undefined)
      ? select(results.map((result) => result.data) as QueriesData<Results>)
      : undefined,
    isError,
    isLoading: !isError && results.some((result) => result.isLoading),
    isPending: !isError && results.some((result) => result.isPending),
  };
}

export const sumUsdResults = (results: UseQueryResult<number>[]) =>
  combineQueryResults({
    results,
    select: (data) => data.reduce((total, value) => total + value, 0),
  });
