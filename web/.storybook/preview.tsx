import type { Preview } from "@storybook/react";
import { sb } from "storybook/test";

import "react-loading-skeleton/dist/skeleton.css";

import "../src/index.css";
import { initializeI18n } from "../src/i18n/config";

initializeI18n();

sb.mock(import("../src/fetchers/fetchPrices.ts"));
sb.mock(import("wagmi"), { spy: true });

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
