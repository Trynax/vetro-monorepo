// Worker entry point – proxies static assets and injects security headers.

/// <reference types="@cloudflare/workers-types" />

import { allChains } from "networks";
import { getUrlOrigin } from "utils/url";

type Env = {
  ASSETS: Fetcher;
};

// Extract unique RPC URLs
const rpcUrls = allChains.flatMap((chain) => chain.rpcUrls.default.http);

// WalletConnect / Reown AppKit + Coinbase Wallet endpoints.
// https://docs.reown.com/advanced/security/content-security-policy
const walletConnectUrls = [
  "https://rpc.walletconnect.com",
  "https://rpc.walletconnect.org",
  "https://relay.walletconnect.com",
  "https://relay.walletconnect.org",
  "wss://relay.walletconnect.com",
  "wss://relay.walletconnect.org",
  "https://pulse.walletconnect.com",
  "https://pulse.walletconnect.org",
  "https://api.web3modal.com",
  "https://api.web3modal.org",
  "https://keys.walletconnect.com",
  "https://keys.walletconnect.org",
  "wss://www.walletlink.org",
  "https://cca-lite.coinbase.com",
  "https://keys.coinbase.com",
];

// CSP img-src values required for WalletConnect / Reown Appkit.
// https://docs.reown.com/advanced/security/content-security-policy
const walletImgSrc = [
  "https://walletconnect.com",
  "https://walletconnect.org",
  "https://secure.walletconnect.com",
  "https://secure.walletconnect.org",
  "https://api.web3modal.com",
  "https://api.web3modal.org",
].join(" ");

// CSP frame-src values required for WalletConnect / Reown Appkit + Coinbase.
// https://docs.reown.com/advanced/security/content-security-policy
const walletFrameSrc = [
  "https://verify.walletconnect.com",
  "https://verify.walletconnect.org",
  "https://secure.walletconnect.com",
  "https://secure.walletconnect.org",
  "https://keys.coinbase.com",
].join(" ");

const analyticsOrigin = getUrlOrigin(import.meta.env.VITE_ANALYTICS_URL);

const allUrls: (string | undefined)[] = [
  import.meta.env.VITE_PORTAL_API_URL,
  import.meta.env.VITE_VETRO_API_URL,
  ...rpcUrls,
  ...walletConnectUrls,
  import.meta.env.VITE_SENTRY_DSN,
  import.meta.env.VITE_ANALYTICS_URL,
  "https://cloudflareinsights.com", // Cloudflare Web Beacon analytics.
];

// Build connect-src dynamically from env vars baked in at build time.
const connectSrc = [
  "'self'",
  ...allUrls.map(getUrlOrigin).filter(Boolean),
].join(" ");

const workerSrc = import.meta.env.VITE_SENTRY_DSN ? "blob:" : "'none'";

// Production CSP is strict and includes a nonce. In dev mode, Vite injects an
// inline React Fast Refresh preamble script, so 'unsafe-inline' is required
// and would be overridden by including a nonce.
const buildScriptSrc = (nonce: string) =>
  [
    "'self'",
    "https://static.cloudflareinsights.com", // Web Analytics beacon.
    "https://challenges.cloudflare.com", // Cloudflare bot management / challenge widget.
    ...(analyticsOrigin ? [analyticsOrigin] : []),
    ...(import.meta.env.DEV ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`]),
  ].join(" ");

// Deny all permissions – mirrors api/src/security-headers.ts.
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

// Generates a cryptographically random nonce per request.
function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

// Builds a Content-Security-Policy header for a request with the given nonce.
//
// The nonce in script-src is redundant with 'self' for our own bundled
// scripts, but Cloudflare's JavaScript Detections parses the CSP response
// header and reuses this nonce for the inline scripts it injects.
// https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/#if-you-have-a-content-security-policy-csp
const buildCsp = (nonce: string) =>
  [
    "base-uri 'none'",
    `connect-src ${connectSrc}`,
    "default-src 'none'",
    "font-src 'self' https://fonts.gstatic.com",
    "form-action 'none'",
    "frame-ancestors 'none'",
    // WalletConnect verify + Coinbase smart wallet + Cloudflare challenges
    // (bot management / Turnstile) render in iframes.
    `frame-src 'self' ${walletFrameSrc} https://challenges.cloudflare.com`,
    `img-src 'self' data: https://hemilabs.github.io https://cdn.jsdelivr.net/gh/curvefi/curve-assets/images/assets/ ${walletImgSrc}`,
    `script-src ${buildScriptSrc(nonce)}`,
    // Tailwind v4 injects styles via a <style> tag, so 'unsafe-inline' is needed.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `worker-src ${workerSrc}`,
    "upgrade-insecure-requests",
  ].join("; ");

// Applied to all responses – these have meaningful effect on sub-resources.
const commonHeaders = {
  "Content-Security-Policy": [
    "default-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "block-all-mixed-content",
    "require-trusted-types-for 'script'",
  ].join("; "),
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
};

// Applied only to HTML documents – these are navigation-level controls.
// CSP is set per-request (with a fresh nonce) in the fetch handler so it
// overrides the commonHeaders CSP.
const htmlHeaders = {
  // See https://docs.base.org/smart-wallet/quickstart#cross-origin-opener-policy
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": permissionsPolicy,
  "X-DNS-Prefetch-Control": "off",
  "X-Frame-Options": "DENY",
};

// Countries subject to geo-restriction: EU 27 member states, EEA (Norway,
// Iceland, Liechtenstein), US and Panama.
const restrictedCountries = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PA",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "US",
]);

function isGeoRestricted(request: Request): boolean {
  const cf = request.cf;
  if (!cf) {
    return false;
  }
  return restrictedCountries.has(String(cf.country ?? ""));
}

export default {
  async fetch(request: Request, env: Env) {
    const response = await env.ASSETS.fetch(request);
    const newResponse = new Response(response.body, response);

    for (const [key, value] of Object.entries(commonHeaders)) {
      newResponse.headers.set(key, value);
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("text/html")) {
      return newResponse;
    }

    for (const [key, value] of Object.entries(htmlHeaders)) {
      newResponse.headers.set(key, value);
    }

    // Geo-restriction session cookie for front-end blocking.
    const restricted = isGeoRestricted(request);
    newResponse.headers.append(
      "Set-Cookie",
      `geo-restricted=${restricted ? "1" : "0"}; SameSite=Strict; Secure; Path=/`,
    );

    // Add dynamic Content-Security-Policy header with unique per-request nonce.
    newResponse.headers.set(
      "Content-Security-Policy",
      buildCsp(generateNonce()),
    );

    return newResponse;
  },
} satisfies ExportedHandler<Env>;
