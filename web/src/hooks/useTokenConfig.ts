import {
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { getTokenConfig } from "@vetro-protocol/treasury/actions";
import { mainnet } from "networks/mainnet";
import type { Address, Chain, Client } from "viem";

import { useEthereumClient } from "./useEthereumClient";
import { treasuryAddressOptions } from "./useTreasuryAddress";

export const tokenConfigOptions = ({
  chainId,
  client,
  gatewayAddress,
  queryClient,
  token,
}: {
  chainId: Chain["id"];
  client: Client | undefined;
  gatewayAddress: Address;
  queryClient: QueryClient;
  token: Address;
}) =>
  queryOptions({
    enabled: !!client,
    async queryFn() {
      const treasuryAddress = await queryClient.ensureQueryData(
        treasuryAddressOptions({ chainId, client, gatewayAddress }),
      );
      const [
        vault,
        oracle,
        stalePeriod,
        depositActive,
        withdrawActive,
        decimals,
      ] = await getTokenConfig(client!, { address: treasuryAddress, token });
      return {
        decimals,
        depositActive,
        oracle,
        stalePeriod,
        vault,
        withdrawActive,
      };
    },
    queryKey: ["token-config", chainId, gatewayAddress, token],
  });

export const useTokenConfig = function ({
  gatewayAddress,
  token,
}: {
  gatewayAddress: Address;
  token: Address;
}) {
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  return useQuery(
    tokenConfigOptions({
      chainId: mainnet.id,
      client,
      gatewayAddress,
      queryClient,
      token,
    }),
  );
};
