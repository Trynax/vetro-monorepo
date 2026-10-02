// Worker entry point – proxies static assets and injects security headers.

/// <reference types="@cloudflare/workers-types" />

import { type Address, getAddress, isAddress, isAddressEqual } from "viem";

import type { StakeDaoCampaign, StakeDaoStrategy } from "./lib/stakeDaoApi";

type Env = {
  ASSETS: Fetcher;
  THEGRAPH_API_KEY: string;
};

// Deny all permissions – mirrors web/src/index.ts.
const permissionsPolicy = [
  "accelerometer",
  "ambient-light-sensor",
  "attribution-reporting",
  "autoplay",
  "battery",
  "bluetooth",
  "camera",
  "ch-ua",
  "ch-ua-arch",
  "ch-ua-bitness",
  "ch-ua-full-version",
  "ch-ua-full-version-list",
  "ch-ua-mobile",
  "ch-ua-model",
  "ch-ua-platform",
  "ch-ua-platform-version",
  "ch-ua-wow64",
  "compute-pressure",
  "cross-origin-isolated",
  "direct-sockets",
  "display-capture",
  "encrypted-media",
  "execution-while-not-rendered",
  "execution-while-out-of-viewport",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "hid",
  "identity-credentials-get",
  "idle-detection",
  "keyboard-map",
  "magnetometer",
  "microphone",
  "midi",
  "navigation-override",
  "payment",
  "picture-in-picture",
  "publickey-credentials-get",
  "screen-wake-lock",
  "serial",
  "storage-access",
  "sync-xhr",
  "usb",
  "web-share",
  "window-management",
  "xr-spatial-tracking",
]
  .map((feature) => `${feature}=()`)
  .join(", ");

// Token USD prices come from the Portal API and on-chain reads use the mainnet
// RPC; both origins are env-driven (see .env / .env.local) so overrides are also
// allowed by the CSP. The RPC env may hold several URLs joined by "+".
const portalApiUrl = import.meta.env.VITE_PORTAL_API_URL;
const rpcConnectSrc = (import.meta.env.VITE_RPC_URL_MAINNET ?? "")
  .split("+")
  .join(" ");

// In dev mode, Vite injects an inline React Fast Refresh preamble script, so
// 'unsafe-inline' is required.
const scriptSrc = [
  "'self'",
  ...(import.meta.env.DEV ? ["'unsafe-inline'"] : []),
].join(" ");

const csp = [
  "base-uri 'none'",
  `connect-src 'self' https://api.curve.finance https://prices.curve.finance ${rpcConnectSrc} ${portalApiUrl}`,
  "default-src 'none'",
  "font-src 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  // Token logos come from the Hemilabs token list (GitHub Pages), falling back
  // to the venues' asset CDNs — Curve, Sushi and Uniswap (all jsDelivr).
  "img-src 'self' data: https://hemilabs.github.io https://cdn.jsdelivr.net",
  `script-src ${scriptSrc}`,
  // Tailwind v4 injects styles via a <style> tag, so 'unsafe-inline' is needed.
  "style-src 'self' 'unsafe-inline'",
  "upgrade-insecure-requests",
  "worker-src 'none'",
].join("; ");

// Applied to all responses – these have meaningful effect on sub-resources.
const commonHeaders = {
  "Content-Security-Policy": "default-src 'none'",
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

// Applied only to HTML documents – these are navigation-level controls.
// CSP is stricter for HTML responses so it overrides the commonHeaders CSP.
const htmlHeaders = {
  "Content-Security-Policy": csp,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": permissionsPolicy,
  "X-DNS-Prefetch-Control": "off",
  "X-Frame-Options": "DENY",
};

const brownfiSubgraphId = "D1UwhrB45geUZTNQ2QwrXwGEhk69iBESApJJzz378ZeS";
const sushiSubgraphId = "2tGWMrDha4164KkFAfkU3rDCtuxGb4q1emXmFdLLzJ8x";

const graphqlProxies: Record<
  string,
  { headers?: Record<string, string>; upstream: (env: Env) => string }
> = {
  "/api/brownfi": {
    upstream: (env) =>
      `https://gateway.thegraph.com/api/${env.THEGRAPH_API_KEY}/subgraphs/id/${brownfiSubgraphId}`,
  },
  "/api/sushi": {
    upstream: () => "https://production.data-gcp.sushi.com/graphql",
  },
  "/api/sushi-subgraph": {
    upstream: (env) =>
      `https://gateway.thegraph.com/api/${env.THEGRAPH_API_KEY}/subgraphs/id/${sushiSubgraphId}`,
  },
  "/api/uniswap": {
    headers: { origin: "https://app.uniswap.org" },
    upstream: () => "https://interface.gateway.uniswap.org/v1/graphql",
  },
};

const merklOpportunitiesPath = "/api/merkl/opportunities";
const merklOpportunitiesUpstream = "https://api.merkl.xyz/v4/opportunities";

// StakeDAO answers with every campaign ever created (several MB) and with
// a large strategies file per chain, and offers no server-side filter for
// either, so the worker trims both lists to the requested gauges. The upstream
// responses are cached because of this.
const stakeDaoCampaignsPath = "/api/stakedao/campaigns";
const stakeDaoCampaignsUpstream =
  "https://api-v3.stakedao.org/votemarket/curve";
const stakeDaoCacheSeconds = 3 * 60;

const stakeDaoStrategiesPath = "/api/stakedao/strategies";
const stakeDaoStrategiesUpstream = (chainId: number) =>
  `https://api.stakedao.org/api/strategies/v2/curve/${chainId}.json`;

const jsonResponse = ({
  body,
  status = 200,
}: {
  body: BodyInit | null;
  status?: number;
}) =>
  new Response(body, {
    headers: { "content-type": "application/json" },
    status,
  });

const fetchStakeDao = (upstream: string) =>
  fetch(upstream, {
    cf: {
      cacheEverything: true,
      cacheTtlByStatus: { "200-299": stakeDaoCacheSeconds, "400-599": 0 },
    },
  });

const servedCampaign = (campaign: StakeDaoCampaign): StakeDaoCampaign => ({
  currentPeriod: {
    rewardPerPeriod: campaign.currentPeriod.rewardPerPeriod,
    rewardPerVote: campaign.currentPeriod.rewardPerVote,
  },
  endTimestamp: campaign.endTimestamp,
  gauge: getAddress(campaign.gauge),
  gaugeChainId: campaign.gaugeChainId,
  id: campaign.id,
  isCanceled: campaign.isCanceled,
  isClosed: campaign.isClosed,
  key: campaign.key,
  rewardToken: {
    price: campaign.rewardToken.price,
    symbol: campaign.rewardToken.symbol,
  },
  totalRewardAmount: campaign.totalRewardAmount,
});

type UpstreamStakeDaoStrategy = Omit<
  StakeDaoStrategy,
  "gaugeAddress" | "rewards"
> & {
  gaugeAddress: StakeDaoStrategy["gaugeAddress"] | null;
  // Some reward tokens come with only an address.
  rewards: { token: { symbol?: string } }[];
};

type GaugedUpstreamStakeDaoStrategy = UpstreamStakeDaoStrategy & {
  gaugeAddress: StakeDaoStrategy["gaugeAddress"];
};

const servedStrategy = (
  strategy: GaugedUpstreamStakeDaoStrategy,
): StakeDaoStrategy => ({
  ...(strategy.apr
    ? { apr: { current: { total: strategy.apr.current.total } } }
    : {}),
  gaugeAddress: getAddress(strategy.gaugeAddress),
  key: strategy.key,
  rewards: strategy.rewards.flatMap(({ token: { symbol } }) =>
    symbol ? [{ token: { symbol } }] : [],
  ),
  tradingApy: strategy.tradingApy,
});

const proxyStakeDaoCampaigns = async function (searchParams: URLSearchParams) {
  const gauges = (searchParams.get("gauges") ?? "").toLowerCase().split(",");
  const response = await fetchStakeDao(stakeDaoCampaignsUpstream);
  if (!response.ok) {
    return jsonResponse({ body: response.body, status: response.status });
  }
  const { campaigns } = (await response.json()) as {
    campaigns: StakeDaoCampaign[];
  };
  return jsonResponse({
    body: JSON.stringify(
      campaigns
        .filter((campaign) => gauges.includes(campaign.gauge.toLowerCase()))
        .map(servedCampaign),
    ),
  });
};

const proxyStakeDaoStrategies = async function (searchParams: URLSearchParams) {
  const chainId = Number(searchParams.get("chainId"));
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    return jsonResponse({ body: null, status: 400 });
  }
  const gauges = (searchParams.get("gauges") ?? "").split(",");
  if (!gauges.every((gauge): gauge is Address => isAddress(gauge))) {
    return jsonResponse({ body: null, status: 400 });
  }
  const hasRequestedGauge = function (
    strategy: UpstreamStakeDaoStrategy,
  ): strategy is GaugedUpstreamStakeDaoStrategy {
    const { gaugeAddress } = strategy;
    return (
      gaugeAddress !== null &&
      gauges.some((gauge) => isAddressEqual(gauge, gaugeAddress))
    );
  };
  const response = await fetchStakeDao(stakeDaoStrategiesUpstream(chainId));
  if (!response.ok) {
    return jsonResponse({ body: response.body, status: response.status });
  }
  const strategies = (await response.json()) as UpstreamStakeDaoStrategy[];
  return jsonResponse({
    body: JSON.stringify(
      strategies.filter(hasRequestedGauge).map(servedStrategy),
    ),
  });
};

type MerklOpportunitiesQuery = {
  campaigns: boolean;
  chainIds: number[];
  identifiers: string[];
  items: number;
  status: string;
};

const proxyMerklOpportunities = async function (request: Request) {
  const { campaigns, chainIds, identifiers, items, status } =
    (await request.json()) as MerklOpportunitiesQuery;
  const search = new URLSearchParams({
    campaigns: String(campaigns),
    chainId: chainIds.join(","),
    identifier: identifiers.join(","),
    items: String(items),
    status,
  });
  const response = await fetch(`${merklOpportunitiesUpstream}?${search}`);
  return jsonResponse({ body: response.body, status: response.status });
};

const proxyGraphql = async function ({
  headers,
  request,
  upstream,
}: {
  headers?: Record<string, string>;
  request: Request;
  upstream: string;
}) {
  const response = await fetch(upstream, {
    body: await request.text(),
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });
  return new Response(response.body, {
    headers: { "content-type": "application/json" },
    status: response.status,
  });
};

const apiHandlers: Record<
  string,
  (params: { request: Request; url: URL }) => Promise<Response>
> = {
  [`GET ${stakeDaoCampaignsPath}`]: ({ url }) =>
    proxyStakeDaoCampaigns(url.searchParams),
  [`GET ${stakeDaoStrategiesPath}`]: ({ url }) =>
    proxyStakeDaoStrategies(url.searchParams),
  [`QUERY ${merklOpportunitiesPath}`]: ({ request }) =>
    proxyMerklOpportunities(request),
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    const graphqlProxy = graphqlProxies[url.pathname];
    if (request.method === "POST" && graphqlProxy) {
      return proxyGraphql({
        headers: graphqlProxy.headers,
        request,
        upstream: graphqlProxy.upstream(env),
      });
    }

    const apiHandler = apiHandlers[`${request.method} ${url.pathname}`];
    if (apiHandler) {
      return apiHandler({ request, url });
    }

    const response = await env.ASSETS.fetch(request);
    const newResponse = new Response(response.body, response);

    for (const [key, value] of Object.entries(commonHeaders)) {
      newResponse.headers.set(key, value);
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.includes("text/html")) {
      for (const [key, value] of Object.entries(htmlHeaders)) {
        newResponse.headers.set(key, value);
      }
    }

    return newResponse;
  },
} satisfies ExportedHandler<Env>;
