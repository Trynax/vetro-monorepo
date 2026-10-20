/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANALYTICS_URL?: string;
  readonly VITE_ANALYTICS_WEBSITE_ID?: string;
  readonly VITE_BUILD_BRANCH: string;
  readonly VITE_BUILD_VERSION: string;
  readonly VITE_DEPLOY_ENV?: string;
  readonly VITE_DEV_WALLET?: string;
  readonly VITE_FIXED_TERM_YIELD_ENABLED?: string;
  readonly VITE_PORTAL_API_URL: string;
  readonly VITE_RPC_URL_MAINNET?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;
  readonly VITE_VETRO_API_URL: string;
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
}
