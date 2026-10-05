import type { Meta, StoryObj } from "@storybook/react";
import { mocked } from "storybook/test";
import { zeroAddress } from "viem";
import { useAccount } from "wagmi";

import { StakeSubmitButton } from "../src/pages/earn/components/stakeForm/stakeSubmitButton";

const mockAccount = (account: Partial<ReturnType<typeof useAccount>>) =>
  mocked(useAccount).mockReturnValue(account as ReturnType<typeof useAccount>);

const meta: Meta<typeof StakeSubmitButton> = {
  beforeEach() {
    mockAccount({ address: zeroAddress });
    return () => mocked(useAccount).mockReset();
  },
  component: StakeSubmitButton,
  decorators: [
    (Story) => (
      <div className="flex w-72 *:flex-1">
        <Story />
      </div>
    ),
  ],
  title: "Components/StakeSubmitButton",
};

export default meta;
type Story = StoryObj<typeof StakeSubmitButton>;

export const Default: Story = {
  args: {
    actionText: "Deposit",
    inputError: undefined,
    isLoading: false,
    isPending: false,
    pendingText: "Depositing...",
  },
};

export const ConnectWallet: Story = {
  args: {
    actionText: "Deposit",
    inputError: undefined,
    isLoading: false,
    isPending: false,
    pendingText: "Depositing...",
  },
  beforeEach() {
    mockAccount({ address: undefined });
  },
};

export const EnterAmount: Story = {
  args: {
    actionText: "Deposit",
    inputError: "enter-amount",
    isLoading: false,
    isPending: false,
    pendingText: "Depositing...",
  },
};

export const InsufficientBalance: Story = {
  args: {
    actionText: "Deposit",
    inputError: "insufficient-balance",
    isLoading: false,
    isPending: false,
    pendingText: "Depositing...",
  },
};

export const InsufficientGas: Story = {
  args: {
    actionText: "Deposit",
    inputError: "insufficient-gas",
    isLoading: false,
    isPending: false,
    pendingText: "Depositing...",
  },
};

export const Pending: Story = {
  args: {
    actionText: "Deposit",
    inputError: undefined,
    isLoading: false,
    isPending: true,
    pendingText: "Depositing...",
  },
};

export const Loading: Story = {
  args: {
    actionText: "Deposit",
    inputError: undefined,
    isLoading: true,
    isPending: false,
    pendingText: "Depositing...",
  },
};

export const Blocked: Story = {
  args: {
    actionText: "Request exit",
    blockingText: "Exit window closed",
    inputError: "enter-amount",
    isLoading: false,
    isPending: false,
    pendingText: "Request exit",
  },
};

export const WithdrawAction: Story = {
  args: {
    actionText: "Withdraw",
    inputError: undefined,
    isLoading: false,
    isPending: false,
    pendingText: "Withdrawing...",
  },
};
