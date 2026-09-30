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
  title: "Components/StakeSubmitButton",
};

export default meta;
type Story = StoryObj<typeof StakeSubmitButton>;

export const Default: Story = {
  args: {
    actionText: "Deposit",
    balancesLoaded: true,
    inputError: undefined,
    isPending: false,
    pendingText: "Depositing...",
  },
};

export const ConnectWallet: Story = {
  args: {
    actionText: "Deposit",
    balancesLoaded: true,
    inputError: undefined,
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
    balancesLoaded: true,
    inputError: "enter-amount",
    isPending: false,
    pendingText: "Depositing...",
  },
};

export const InsufficientBalance: Story = {
  args: {
    actionText: "Deposit",
    balancesLoaded: true,
    inputError: "insufficient-balance",
    isPending: false,
    pendingText: "Depositing...",
  },
};

export const InsufficientGas: Story = {
  args: {
    actionText: "Deposit",
    balancesLoaded: true,
    inputError: "insufficient-gas",
    isPending: false,
    pendingText: "Depositing...",
  },
};

export const Pending: Story = {
  args: {
    actionText: "Deposit",
    balancesLoaded: true,
    inputError: undefined,
    isPending: true,
    pendingText: "Depositing...",
  },
};

export const BalancesLoading: Story = {
  args: {
    actionText: "Deposit",
    balancesLoaded: false,
    inputError: undefined,
    isPending: false,
    pendingText: "Depositing...",
  },
};

export const WithdrawAction: Story = {
  args: {
    actionText: "Withdraw",
    balancesLoaded: true,
    inputError: undefined,
    isPending: false,
    pendingText: "Withdrawing...",
  },
};
