import { useTokenInfo } from "hooks/useTokenInfo";
import { Fragment } from "react";
import Skeleton from "react-loading-skeleton";
import { formatEvmAddress } from "utils/format";
import type { Address } from "viem";

type CoinSymbolProps = {
  address: Address;
  chainId: number;
};

const CoinSymbol = function ({ address, chainId }: CoinSymbolProps) {
  const { data: token, isError } = useTokenInfo({ address, chainId });
  if (token) {
    return token.symbol;
  }
  if (isError) {
    return formatEvmAddress(address);
  }
  return <Skeleton inline width={40} />;
};

type CoinSymbolsProps = {
  coins: CoinSymbolProps[];
  separator: string;
};

export const CoinSymbols = ({ coins, separator }: CoinSymbolsProps) =>
  coins.map(({ address, chainId }, index) => (
    <Fragment key={address}>
      {index > 0 && separator}
      <CoinSymbol address={address} chainId={chainId} />
    </Fragment>
  ));
