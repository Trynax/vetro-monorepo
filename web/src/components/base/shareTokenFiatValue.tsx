import { useQuery, useQueryClient } from "@tanstack/react-query";
import { knownTokens, type Token } from "@vetro-protocol/core";
import { RenderFiatValue } from "components/base/fiatValue";
import { convertToAssetsQueryOptions } from "hooks/useConvertToAssets";
import { useEthereumClient } from "hooks/useEthereumClient";
import { vaultPeggedTokenQueryOptions } from "hooks/useVaultPeggedToken";
import type { TokenWithGateway } from "types";
import { mainnet } from "viem/chains";

type Props = {
  token: Token;
  value: bigint | undefined;
};

type Result = {
  assetsValue: bigint;
  peggedToken: TokenWithGateway;
};

// On mainnet, each share token entry's address is the staking vault contract
// itself (the vault is an ERC-4626 ERC-20). So the mainnet-listed share token
// with this symbol gives us the vault address directly.
const findStakingVaultAddress = (shareSymbol: string) =>
  knownTokens.find(
    (t) =>
      t.chainId === mainnet.id &&
      t.symbol === shareSymbol &&
      t.extensions?.isVaultShare,
  )?.address;

export function ShareTokenFiatValue({ token, value }: Props) {
  const client = useEthereumClient();
  const queryClient = useQueryClient();

  const { data, status } = useQuery<Result>({
    enabled: !!client && value !== undefined,
    placeholderData: (prev) => prev,
    async queryFn() {
      const stakingVaultAddress = findStakingVaultAddress(token.symbol)!;
      const [peggedToken, assetsValue] = await Promise.all([
        queryClient.ensureQueryData(
          vaultPeggedTokenQueryOptions({
            client,
            queryClient,
            stakingVaultAddress,
          }),
        ),
        queryClient.ensureQueryData(
          convertToAssetsQueryOptions({
            client: client!,
            shares: value,
            stakingVaultAddress,
          }),
        ),
      ]);
      return { assetsValue, peggedToken };
    },
    queryKey: ["share-token-fiat", token.symbol, value?.toString()],
  });

  return (
    <RenderFiatValue
      queryStatus={status}
      token={data?.peggedToken}
      value={data?.assetsValue}
    />
  );
}
