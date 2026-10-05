import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { fetchRequestExitFees } from "fetchers/earn/targetYieldPool/fetchRequestExitFees";

const requestExitFeesOptions = ({
  amount,
  token,
}: {
  amount: bigint;
  token: Token;
}) =>
  queryOptions({
    enabled: amount > 0n,
    queryFn: ({ client: queryClient }) =>
      fetchRequestExitFees({ queryClient, token }),
    queryKey: ["target-yield-pool-request-exit-fees", token.chainId],
  });

export const useRequestExitFees = ({
  amount,
  token,
}: {
  amount: bigint;
  token: Token;
}) => useQuery(requestExitFeesOptions({ amount, token }));
