import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../src/components/base/badge";
import { InfoCard } from "../src/components/base/infoCard";

const SparkleIcon = () => (
  <svg
    fill="none"
    height="16"
    viewBox="0 0 16 16"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      clipRule="evenodd"
      d="M5 4c.177 0 .347.062.482.174a.75.75 0 0 1 .256.442l.252 1.388a1.5 1.5 0 0 0 1.006 1.006l1.388.252a.75.75 0 0 1 .442.256.75.75 0 0 1-.442.738l-1.388.252a1.5 1.5 0 0 0-1.006 1.006l-.252 1.388a.75.75 0 0 1-.738.442.75.75 0 0 1-.738-.442l-.252-1.388a1.5 1.5 0 0 0-1.006-1.006L1.616 8.738A.75.75 0 0 1 1.174 8.482.75.75 0 0 1 1.616 7.262l1.388-.252a1.5 1.5 0 0 0 1.006-1.006l.252-1.388A.75.75 0 0 1 4.52 4.174.75.75 0 0 1 5 4Zm7-3a.75.75 0 0 1 .721.544l.195.682a1.5 1.5 0 0 0 1.053 1.053l.682.195a.75.75 0 0 1 0 1.442l-.682.195a1.5 1.5 0 0 0-1.053 1.053l-.195.682a.75.75 0 0 1-1.442 0l-.195-.682a1.5 1.5 0 0 0-1.053-1.053l-.682-.195a.75.75 0 0 1 0-1.442l.682-.195a1.5 1.5 0 0 0 1.053-1.053l.195-.682A.75.75 0 0 1 12 1Zm-2 10a.75.75 0 0 1 .728.568c.043.17.13.325.255.449.124.124.28.212.45.255a.75.75 0 0 1 0 1.456 1 1 0 0 0-.45.255 1 1 0 0 0-.255.449.75.75 0 0 1-1.456 0 1 1 0 0 0-.255-.449 1 1 0 0 0-.449-.255.75.75 0 0 1 0-1.456 1 1 0 0 0 .449-.255 1 1 0 0 0 .255-.449A.75.75 0 0 1 10 11Z"
      fill="#416BFF"
      fillRule="evenodd"
    />
  </svg>
);

const meta: Meta<typeof InfoCard<string>> = {
  argTypes: {
    data: {
      control: "text",
    },
    icon: {
      control: false,
    },
    isLoading: {
      control: "boolean",
    },
    label: {
      control: "text",
    },
    render: {
      control: false,
    },
    subtitle: {
      control: false,
    },
  },
  component: InfoCard,
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  title: "Components/InfoCard",
};

export default meta;
type Story = StoryObj<typeof InfoCard<string>>;

export const Default: Story = {
  args: {
    data: "12.5%",
    icon: <SparkleIcon />,
    label: "Target fixed APR",
    render: (data) => data,
  },
};

export const WithTextSubtitle: Story = {
  args: {
    data: "12.5%",
    icon: <SparkleIcon />,
    label: "Target fixed APR",
    render: (data) => data,
    subtitle: "Fixed until Feb 13, 2026",
  },
};

export const WithBadgeSubtitle: Story = {
  args: {
    data: "192.00",
    icon: <SparkleIcon />,
    label: "Pool size",
    render: (data) => (
      <>
        <span className="mr-1">$</span>
        {data}
      </>
    ),
    subtitle: <Badge>0.101659… WETH</Badge>,
  },
};

export const WithEmphasizedSubtitle: Story = {
  args: {
    data: "$4.2M",
    icon: <SparkleIcon />,
    label: "Pool capacity",
    render: (data) => (
      <>
        {data} <span className="text-gray-500">/ $5.0M</span>
      </>
    ),
    subtitle: (
      <>
        <span className="mr-1 text-gray-900">$800K</span> remaining
      </>
    ),
  },
};

export const Loading: Story = {
  args: {
    data: undefined,
    icon: <SparkleIcon />,
    isLoading: true,
    label: "Your staked balance",
    render: (data) => data,
    subtitle: <Badge>From 1 pool</Badge>,
  },
};

export const NoData: Story = {
  args: {
    data: undefined,
    icon: <SparkleIcon />,
    label: "Your staked balance",
    render: (data) => data,
    subtitle: <Badge>From 1 pool</Badge>,
  },
};
