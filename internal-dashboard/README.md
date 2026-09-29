# Internal Dashboard

Internal-facing dashboard for tracking various operational metrics. Each metric area
lives on its own tab, mapped to a URL.

- **DEX** (`/dex`) — liquidity of the tracked Vetro pools on Curve, Sushi and
  Uniswap (Ethereum) and BrownFi (Hemi), with the total TVL in USD and the
  pool count (price bands excluded to avoid double counting; table filters
  don't apply). A warning icon flags pools with any leg missing a USD price;
  those without a TVL are counted but not summed. Each pool also has a detail
  view at `/dex/:poolId`.
- **Hemi Earn** (`/hemi-earn`) — status of the Hemi Earn agent: keepers,
  ownership, proxy implementation and its pending vault cooldowns.

`/` and unknown paths redirect to the DEX tab.

It's a Vite + React + TypeScript + Tailwind v4 SPA, deployed to Cloudflare via a Worker
that serves the static assets and injects security headers (see `src/index.ts`).

## Environment Variables

Set these in `internal-dashboard/.env` (or a `.env.local` override) before you run `dev` or `build`. The committed `.env` holds the public development values only.

| Variable               | Required | Description                                                                                                                                                          |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_PORTAL_API_URL`  | Yes      | Hemi Portal API base URL (used for token prices).                                                                                                                    |
| `VITE_RPC_URL_MAINNET` | Yes      | RPC URL(s) for Ethereum mainnet. Several URLs joined by `+` become a fallback transport. Baked into the client bundle at build time, thus readable by every visitor. |

The Worker builds its `connect-src` CSP directive from the same two variables (see `src/index.ts`), so an override is allowed by the CSP without more changes.

For the deployed dashboard, set the production values as Cloudflare Workers Builds variables in the Cloudflare dashboard. Vite gives these priority over the committed `.env` at build time. Thus the paid RPC URL stays out of the repository.

### Worker secrets

`THEGRAPH_API_KEY` is a The Graph gateway key, used to read the BrownFi and Sushi subgraphs.
For development, put it in `internal-dashboard/.dev.vars` (gitignored):

```ini
THEGRAPH_API_KEY = "your-key"
```

For the deployed dashboard, add it as a Cloudflare secret (Workers → Settings → Variables and Secrets).

## Development

```sh
pnpm dev      # start the Vite dev server
pnpm build    # typecheck + production build
pnpm preview  # preview the production build
pnpm tsc      # typecheck only
```

## Deployment

Deployed to Cloudflare with `wrangler` (see `wrangler.jsonc`). The production environment variables come from the Cloudflare Workers Builds variables (see [Environment Variables](#environment-variables)).
