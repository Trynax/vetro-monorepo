import { combineQueryResults, type QueryState } from "utils/queries";

export const combineWithEpochId = <T>({
  epochId,
  query,
}: {
  epochId: QueryState<bigint>;
  query: QueryState<T>;
}) =>
  combineQueryResults({
    results: [epochId, query],
    select: ([, data]) => data,
  });
