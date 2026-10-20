import "./instrument";
import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";

import { reactErrorHandler } from "@sentry/react";
import { initializeI18n } from "i18n/config";
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app";
import { AddressRestriction } from "./components/addressRestriction";
import { PendingActivityReconciliation } from "./components/pendingActivityReconciliation";
import { Web3Provider } from "./providers/web3Provider";

initializeI18n();

// Dev-only headless wallet for the seeded fork (`dev:fork`); the DEV guard
// keeps it out of production bundles. Awaited so the EIP-6963 announcement
// precedes wagmi's reconnect-on-mount, which reconnects it across reloads.
if (import.meta.env.DEV && import.meta.env.VITE_DEV_WALLET === "true") {
  try {
    await import("./dev-wallet").then((module) => module.installDevWallet());
  } catch (error) {
    // A broken dev wallet must not blank the whole app.
    // eslint-disable-next-line no-console -- dev-only
    console.error("Dev wallet failed to install:", error);
  }
}

const handleReactError = reactErrorHandler();
ReactDOM.createRoot(document.getElementById("root")!, {
  onCaughtError: handleReactError,
  onRecoverableError: handleReactError,
  onUncaughtError: handleReactError,
}).render(
  <React.StrictMode>
    <Web3Provider>
      <AddressRestriction />
      <PendingActivityReconciliation />
      <App />
    </Web3Provider>
  </React.StrictMode>,
);
