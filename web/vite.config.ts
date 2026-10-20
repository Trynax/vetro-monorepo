import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { defineConfig, loadEnv, type Plugin, type UserConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

function injectUmamiIfEnabled() {
  let env: Record<string, string> = {};
  return {
    configResolved(config) {
      env = config.env;
    },
    name: "umami-analytics",
    transformIndexHtml: {
      handler(html) {
        const src = env.VITE_ANALYTICS_URL;
        const websiteId = env.VITE_ANALYTICS_WEBSITE_ID;
        if (!src || !websiteId) {
          return html;
        }
        return {
          html,
          tags: [
            {
              attrs: {
                "data-auto-track": "false",
                "data-website-id": websiteId,
                defer: true,
                src,
              },
              injectTo: "head",
              tag: "script",
            },
          ],
        };
      },
      order: "post",
    },
  } satisfies Plugin;
}

function getLocalBuildInfo() {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
    }).trim();
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).trim();

    return { branch, version: `${commit}${dirty ? "-dirty" : ""}` };
  } catch {
    return { branch: "dev", version: "dev" };
  }
}

function getBuildInfo(env: Record<string, string>) {
  const localBuildInfo = getLocalBuildInfo();

  return {
    branch:
      env.VITE_BUILD_BRANCH ||
      process.env.WORKERS_CI_BRANCH ||
      localBuildInfo.branch,
    version:
      env.VITE_BUILD_VERSION ||
      process.env.WORKERS_CI_COMMIT_SHA ||
      localBuildInfo.version,
  };
}

const config = {
  build: {
    // "hidden" generates source maps for Sentry but strips sourceMappingURL
    // from the output so browsers can't discover them. "true" also serves them
    // publicly.
    sourcemap:
      process.env.VITE_DEPLOY_ENV === "production" ? ("hidden" as const) : true,
  },
  plugins: [
    react(),
    cloudflare(),
    nodePolyfills({
      include: ["http", "https"],
    }),
    tailwindcss(),
    injectUmamiIfEnabled(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
} satisfies UserConfig;

if (process.env.VITE_DEPLOY_ENV) {
  // Sentry plugin shall be last to ensure source maps are generated correctly
  // and tree-shaking doesn't remove Sentry's instrumentation.
  config.plugins.push(
    sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "hemi-labs",
      project: "vetro-app",
      release: {
        deploy: {
          env: process.env.VITE_DEPLOY_ENV,
        },
      },
      telemetry: false,
    }),
  );
}

export default defineConfig(function ({ mode }) {
  const buildInfo = getBuildInfo(loadEnv(mode, process.cwd(), ""));

  return {
    ...config,
    define: {
      "import.meta.env.VITE_BUILD_BRANCH": JSON.stringify(buildInfo.branch),
      "import.meta.env.VITE_BUILD_VERSION": JSON.stringify(buildInfo.version),
    },
  };
});
