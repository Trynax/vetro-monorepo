import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchTokenInfo } from "fetchers/fetchTokenInfo";
import type { Address, Chain, Client } from "viem";
import { usePublicClient } from "wagmi";

const tokenInfoQueryKey = ({
  address,
  chainId,
}: {
  address: Address | undefined;
  chainId: Chain["id"];
}) => ["token-info", chainId, address];

export const tokenInfoOptions = ({
  address,
  chainId,
  client,
}: {
  address: Address | undefined;
  chainId: Chain["id"];
  client: Client | undefined;
}) =>
  queryOptions({
    enabled: !!client && !!address,
    gcTime: Infinity,
    queryFn: () => fetchTokenInfo({ address: address!, client: client! }),
    queryKey: tokenInfoQueryKey({ address, chainId }),
    // cache indefinitely as the token info is unlikely to change
    staleTime: Infinity,
  });

export const useTokenInfo = function ({
  address,
  chainId,
}: {
  address: Address;
  chainId: Chain["id"];
}) {
  const client = usePublicClient({ chainId });
  return useQuery(tokenInfoOptions({ address, chainId, client }));
};
