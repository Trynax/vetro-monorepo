import type { Token } from "@vetro-protocol/core";
import type { Address } from "viem";

export type NativeToken = Omit<Token, "address">;

export type TokenWithGateway = Token & { gatewayAddress: Address };

export type BridgeableToken = Token & {
  oftAdapterAddress?: Address;
  sharedDecimals: number;
};

// Raw response shape from GET /analytics/treasury.
export type TreasuryToken = {
  activeStrategies: { name: string; totalDebt: string }[];
  latestPrice: string;
  priceDecimals: number;
  tokenAddress: Address;
  totalDebt: string;
  withdrawable: string;
};

// Raw response shape from GET /analytics/tvl-history.
type TvlHistoryToken = {
  price: string | null;
  tokenAddress: Address;
  unitPrice: string | null;
  withdrawable: string;
};

export type TvlHistoryEntry = {
  pegBaseUsdPrice: number | null;
  peggedTokenAddress: Address;
  timestamp: number;
  tokens: TvlHistoryToken[];
  totalSupply: string;
};
