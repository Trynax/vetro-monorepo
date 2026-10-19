import { knownTokens } from "@vetro-protocol/core";
import { type Address, isAddressEqual } from "viem";
import { mainnet } from "viem/chains";

export const portalUsdPrice = function ({
  address,
  prices,
}: {
  address: Address;
  prices: Record<string, string>;
}) {
  const token = knownTokens.find(
    (known) =>
      // Though the token may be in other chain, we'll use mainnet  as the canonical source
      known.chainId === mainnet.id && isAddressEqual(known.address, address),
  );
  const priceSymbol = (
    token?.extensions?.priceSymbol ?? token?.symbol
  )?.toUpperCase();
  const price = priceSymbol === undefined ? undefined : prices[priceSymbol];
  return price === undefined ? undefined : Number(price);
};
