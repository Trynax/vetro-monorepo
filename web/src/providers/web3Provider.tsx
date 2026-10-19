import {
  type DisclaimerComponent,
  getDefaultConfig,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import {
  binanceWallet,
  // coinbaseWallet is deprecated in favor of baseAccount (no removal date
  // announced). baseAccount is a different UX (passkey-based smart wallet, no
  // extension/QR support), so this is a product decision, not a simple rename.
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRpcTransport } from "@vetro-protocol/core";
import { Trans } from "react-i18next";
import { WagmiProvider } from "wagmi";

import { ExternalLink } from "../components/base/externalLink";
import { allChains } from "../networks";

export const config = getDefaultConfig({
  appIcon: "https://app.vetro.org/vetroLogo.png",
  appName: "Vetro",
  appUrl: "https://app.vetro.org",
  chains: allChains,
  projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
  transports: Object.fromEntries(
    allChains.map((chain) => [chain.id, createRpcTransport(chain)]),
  ),
  wallets: [
    {
      groupName: "Popular",
      wallets: [
        safeWallet,
        metaMaskWallet,
        binanceWallet,
        coinbaseWallet,
        rainbowWallet,
        walletConnectWallet,
      ],
    },
  ],
});

// React Query's default of 3 retries delays error states. RPC reads also get
// viem's own retries (and URL fallback when a chain has several RPC URLs).
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

const disclaimerLinkClassName =
  "font-medium text-blue-500 transition-colors hover:text-blue-600";

const WalletDisclaimer: DisclaimerComponent = ({ Text }) => (
  <Text>
    <Trans
      components={{
        privacy: (
          <ExternalLink
            className={disclaimerLinkClassName}
            href="https://vetro.org/privacy-policy"
          />
        ),
        terms: (
          <ExternalLink
            className={disclaimerLinkClassName}
            href="https://vetro.org/terms-of-use"
          />
        ),
      }}
      i18nKey="common.wallet-disclaimer"
    />
  </Text>
);

export const Web3Provider = ({ children }: { children: React.ReactNode }) => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider appInfo={{ disclaimer: WalletDisclaimer }}>
        {children}
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
