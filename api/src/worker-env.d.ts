// Worker environment bindings.
// When you add or rename a binding in `wrangler.jsonc`,
// update this interface to match.
interface Env {
  CACHE_KV: KVNamespace;
  CONTACT_FORM_RECIPIENT?: string;
  CONTACT_FORM_SENDER?: string;
  CUSTOM_RPC_URL_MAINNET?: string;
  MERKL_OPPORTUNITY_SVETBTC?: string;
  MERKL_OPPORTUNITY_SVUSD?: string;
  ORIGINS: string;
  PORTAL_API_URL: string;
  SEND_EMAIL: SendEmail;
  CF_VERSION_METADATA?: WorkerVersionMetadata;
  SENTRY_DSN?: string;
  SUBGRAPH_API_KEY?: string;
  SUBGRAPH_ID?: string;
  SUBGRAPH_URL?: string;
  TURNSTILE_ALLOWED_HOSTNAMES?: string;
  TURNSTILE_SECRET_KEY?: string;
  WEBSITE_URL: string;
}
