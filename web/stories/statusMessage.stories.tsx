import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../src/components/base/button";
import { StatusMessage } from "../src/components/base/statusMessage";
import { SearchCircleIcon } from "../src/components/icons/searchCircleIcon";
import { WarningCircleIcon } from "../src/components/icons/warningCircleIcon";

const meta = {
  component: StatusMessage,
  title: "Components/StatusMessage",
} satisfies Meta<typeof StatusMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    description: "Try a different search term.",
    icon: <SearchCircleIcon />,
    title: "No results found",
  },
};

export const WithAction: Story = {
  args: {
    action: <Button>Disconnect wallet</Button>,
    description:
      "Due to regulations, we're unable to offer you access at this time.",
    icon: <WarningCircleIcon />,
    title: "Vetro isn't available for your wallet",
  },
};
