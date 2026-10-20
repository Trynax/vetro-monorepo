import type { QueryClient } from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { fetchTotalNetworkFees } from "fetchers/fetchTotalNetworkFees";
import { getChainById } from "networks";

// TODO estimate fees from VUSDx contract
// https://github.com/vetro-protocol/vetro-monorepo/issues/646
const requestRedeemGasUnits = 600000n;

export const fetchRequestExitFees = ({
  queryClient,
  token,
}: {
  queryClient: QueryClient;
  token: Token;
}) =>
  fetchTotalNetworkFees({
    chain: getChainById(token.chainId),
    gasUnits: requestRedeemGasUnits,
    queryClient,
  });
