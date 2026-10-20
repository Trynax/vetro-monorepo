import type { Meta, StoryObj } from "@storybook/react";
import { knownTokens, type Token } from "@vetro-protocol/core";
import { useState } from "react";
import { mainnet } from "viem/chains";

import { TokenDropdown } from "../src/components/tokenDropdown";

import { withWagmi } from "./withWagmi";

const meta = {
  args: {},
  component: TokenDropdown,
  decorators: [withWagmi()],
  title: "Components/TokenDropdown",
} satisfies Meta<typeof TokenDropdown>;

export default meta;

type Story = StoryObj<typeof meta>;

const storyTokens = ["USDC", "USDT"];
const tokens = knownTokens.filter(
  (t) => t.chainId === mainnet.id && storyTokens.includes(t.symbol),
);

export const Default: Story = {
  args: {
    onChange: () => ({}),
    tokens,
    value: tokens[0],
  },
  render: function Render(args) {
    const [selectedToken, setSelectedToken] = useState<Token>(args.value);

    function handleTokenSelect(token: Token) {
      setSelectedToken(token);
    }

    return (
      <div className="w-[120px]">
        <TokenDropdown
          onChange={handleTokenSelect}
          tokens={args.tokens}
          value={selectedToken}
        />
      </div>
    );
  },
};

const tokensWithMissingLogo: Token[] = [
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    chainId: 1,
    decimals: 6,
    logoURI: "https://hemilabs.github.io/token-list/l1Logos/usdc.svg",
    name: "USDCoin",
    symbol: "USDC",
  },
  {
    address: "0x1234567890123456789012345678901234567890",
    chainId: 1,
    decimals: 18,
    logoURI: "https://some.invalid.url/test.png",
    name: "Token Without Logo",
    symbol: "TWL",
  },
];

export const SingleToken: Story = {
  args: {
    onChange: () => ({}),
    tokens: [tokens[0]],
    value: tokens[0],
  },
  render: function Render(args) {
    const [selectedToken, setSelectedToken] = useState<Token>(args.value);

    function handleTokenSelect(token: Token) {
      setSelectedToken(token);
    }

    return (
      <div className="w-[120px]">
        <TokenDropdown
          onChange={handleTokenSelect}
          tokens={args.tokens}
          value={selectedToken}
        />
      </div>
    );
  },
};

export const WithMissingLogoUri: Story = {
  args: {
    onChange: () => ({}),
    tokens: tokensWithMissingLogo,
    value: tokensWithMissingLogo[1],
  },
  render: function Render(args) {
    const [selectedToken, setSelectedToken] = useState<Token>(args.value);

    function handleTokenSelect(token: Token) {
      setSelectedToken(token);
    }

    return (
      <div className="w-[120px]">
        <TokenDropdown
          onChange={handleTokenSelect}
          tokens={args.tokens}
          value={selectedToken}
        />
      </div>
    );
  },
};
