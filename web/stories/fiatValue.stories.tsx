import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient } from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { mocked } from "storybook/test";
import { parseUnits } from "viem";

import { RenderFiatValue } from "../src/components/base/fiatValue";
import { fetchPrices } from "../src/fetchers/fetchPrices";
import { mainnet } from "../src/networks/mainnet";

import { withWagmi } from "./withWagmi";

const usdc: Token = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  chainId: 1,
  decimals: 6,
  logoURI: "https://hemilabs.github.io/token-list/l1Logos/usdc.svg",
  name: "USD Coin",
  symbol: "USDC",
};

const prices = { USDC: "1.00" };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});
queryClient.setQueryData(["prices", mainnet.id], prices);

const meta = {
  beforeEach() {
    mocked(fetchPrices).mockResolvedValue(prices);
    return () => mocked(fetchPrices).mockReset();
  },
  component: RenderFiatValue,
  decorators: [withWagmi(queryClient)],
  title: "Components/FiatValue",
} satisfies Meta<typeof RenderFiatValue>;

export default meta;

type StoryType = StoryObj<typeof meta>;

export const WithValue: StoryType = {
  args: {
    queryStatus: "success",
    token: usdc,
    value: parseUnits("125.50", usdc.decimals),
  },
};

export const Loading: StoryType = {
  args: {
    queryStatus: "pending",
    token: usdc,
    value: undefined,
  },
};

export const Error: StoryType = {
  args: {
    queryStatus: "error",
    token: usdc,
    value: undefined,
  },
};
