import type { Meta, StoryObj } from "@storybook/react";

import { PoolInfoItem } from "../src/pages/earn/components/poolInfoBar/poolInfoItem";

const meta: Meta<typeof PoolInfoItem<string>> = {
  component: PoolInfoItem,
  title: "Earn/PoolInfoItem",
};

export default meta;
type Story = StoryObj<typeof PoolInfoItem<string>>;

export const Default: Story = {
  args: {
    data: "0xdcfe...b5f9",
    label: "Pool contract",
  },
};

export const Pending: Story = {
  args: {
    data: undefined,
    isPending: true,
    label: "Pool deposits",
  },
};

export const WithValue: Story = {
  args: {
    data: "$268.24M",
    label: "Pool deposits",
  },
};

export const WithRender: Story = {
  args: {
    data: "0xdcfe...b5f9",
    label: "Pool contract",
    render: (address) => (
      <a
        className="text-xsm font-semibold text-orange-500 hover:underline"
        href="https://etherscan.io"
        rel="noopener noreferrer"
        target="_blank"
      >
        {address}
      </a>
    ),
  },
};

export const NullData: Story = {
  args: {
    data: null,
    label: "Target fixed APR",
  },
};
