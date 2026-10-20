import type { Meta, StoryObj } from "@storybook/react";
import { knownTokens, type Token } from "@vetro-protocol/core";
import { useState } from "react";
import { mainnet } from "viem/chains";

import { MaxButton } from "../src/components/base/maxButton";
import { GearIcon } from "../src/components/icons/gearIcon";
import { TokenDropdown } from "../src/components/tokenDropdown";
import { TokenInput } from "../src/components/tokenInput";
import { TokenSelectorReadOnly } from "../src/components/tokenSelectorReadOnly";
import { useAmount } from "../src/hooks/useAmount";

import { withWagmi } from "./withWagmi";

const meta = {
  component: TokenInput,
  decorators: [withWagmi()],
  title: "Components/TokenInput",
} satisfies Meta<typeof TokenInput>;

export default meta;

type Story = StoryObj<typeof meta>;

const storyTokens = ["USDC", "USDT"];
const tokens = knownTokens.filter(
  (t) => t.chainId === mainnet.id && storyTokens.includes(t.symbol),
);

type Props = {
  label: string;
  value: string;
};

const StoryBalance = ({ label, value }: Props) => (
  <div className="flex items-center gap-1">
    <span className="text-gray-500">{label}:</span>
    <span className="text-gray-900">{value}</span>
  </div>
);

export const SwitchToken: Story = {
  args: {
    balance: <StoryBalance label="Balance" value="2" />,
    fiatValue: "0.00",
    label: "You are swapping",
    maxButton: <MaxButton onClick={() => alert("max clicked")} />,
    onChange: () => ({}),
    tokenSelector: undefined,
    value: "0",
  },
  render: function Render(args) {
    const [amount, setAmount] = useAmount();
    const [selectedToken, setSelectedToken] = useState<Token>(tokens[0]);

    function handleTokenSelect(token: Token) {
      setSelectedToken(token);
    }

    return (
      <div className="w-[450px]">
        <TokenInput
          {...args}
          onChange={setAmount}
          tokenSelector={
            <TokenDropdown
              onChange={handleTokenSelect}
              tokens={tokens}
              value={selectedToken}
            />
          }
          value={amount}
        />
      </div>
    );
  },
};

export const ReadOnlyToken: Story = {
  args: {
    balance: <StoryBalance label="Available to withdraw" value="200" />,
    fiatValue: "0.00",
    label: "You will withdraw",
    maxButton: <MaxButton onClick={() => alert("max clicked")} />,
    onChange: () => ({}),
    tokenSelector: (
      <TokenSelectorReadOnly
        logoURI={tokens[0].logoURI}
        symbol={tokens[0].symbol}
      />
    ),
    value: "0",
  },
  render: function Render(args) {
    const [amount, setAmount] = useAmount();

    return (
      <div className="w-[450px]">
        <TokenInput {...args} onChange={setAmount} value={amount} />
      </div>
    );
  },
};

export const WithHeaderAction: Story = {
  args: {
    balance: <StoryBalance label="Balance" value="2" />,
    fiatValue: "0.00",
    headerAction: (
      <button
        aria-label="Open settings"
        className="cursor-pointer text-gray-700 hover:text-gray-900"
        onClick={() => alert("header action clicked")}
        type="button"
      >
        <GearIcon />
      </button>
    ),
    label: "You are swapping",
    maxButton: <MaxButton onClick={() => alert("max clicked")} />,
    onChange: () => ({}),
    tokenSelector: undefined,
    value: "0",
  },
  render: function Render(args) {
    const [amount, setAmount] = useAmount();
    const [selectedToken, setSelectedToken] = useState<Token>(tokens[0]);

    return (
      <div className="w-[450px]">
        <TokenInput
          {...args}
          onChange={setAmount}
          tokenSelector={
            <TokenDropdown
              onChange={setSelectedToken}
              tokens={tokens}
              value={selectedToken}
            />
          }
          value={amount}
        />
      </div>
    );
  },
};

export const WithError: Story = {
  args: {
    balance: <StoryBalance label="Balance" value="2" />,
    errorKey: "insufficient-balance",
    fiatValue: "100.00",
    label: "You are swapping",
    maxButton: <MaxButton onClick={() => alert("max clicked")} />,
    onChange: () => ({}),
    tokenSelector: (
      <TokenSelectorReadOnly
        logoURI={tokens[0].logoURI}
        symbol={tokens[0].symbol}
      />
    ),
    value: "100",
  },
  render: function Render(args) {
    const [amount, setAmount] = useAmount(args.value);

    return (
      <div className="w-[450px]">
        <TokenInput {...args} onChange={setAmount} value={amount} />
      </div>
    );
  },
};
