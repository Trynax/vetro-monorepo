import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Entries copied verbatim from StakeDAO's live
// https://api.stakedao.org/api/strategies/v2/curve/1.json (2026-10-05):
// WETH/KP3R (a reward token with only an address), VUSD/crvUSD and VUSD/msUSD.
import liveStrategies from "../test/fixtures/stakeDaoCurveStrategies.json";

import worker from "./index";

const crvUsdGauge = "0x737e7700e03A8c451C9B72103554a40760F1B57A";
const msUsdGauge = "0x28a72343bFf5e10b36E72d86b1041ED2447Dc0Cc";

const upstreamFeed = [
  ...liveStrategies,
  // The feed type allows a null gauge; none is null today, so add one.
  {
    ...liveStrategies[1],
    gaugeAddress: null,
    key: "1-0x9999999999999999999999999999999999999999",
  },
];

const env = {
  ASSETS: {
    fetch() {
      throw new Error("The request fell through to the static assets");
    },
  },
  THEGRAPH_API_KEY: "",
};

const requestStrategies = (query: string) =>
  worker.fetch(
    new Request(`http://localhost/api/stakedao/strategies?${query}`),
    // @ts-expect-error the stub implements only the Fetcher method the worker calls
    env,
  );

const msUsdServed = {
  apr: { current: { total: 7.871434679506586 } },
  gaugeAddress: msUsdGauge,
  key: "1-0x757360820728819953937b752f6b83aeb11090c7",
  rewards: [{ apr: 0, end: 0, token: { symbol: "CRV" } }],
  tradingApy: 0.01,
};

const crvUsdServed = {
  apr: { current: { total: 18.423951191461402 } },
  gaugeAddress: crvUsdGauge,
  key: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
  rewards: [{ apr: 0, end: 0, token: { symbol: "CRV" } }],
  tradingApy: 0.08,
};

describe("GET /api/stakedao/strategies", function () {
  const upstreamFetch = vi.fn();

  beforeEach(function () {
    upstreamFetch.mockImplementation(
      async () => new Response(JSON.stringify(upstreamFeed)),
    );
    vi.stubGlobal("fetch", upstreamFetch);
  });

  afterEach(function () {
    vi.unstubAllGlobals();
  });

  it("serves the trimmed VUSD/msUSD and VUSD/crvUSD strategies from the live feed shape", async function () {
    const response = await requestStrategies(
      `chainId=1&gauges=${msUsdGauge},${crvUsdGauge}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    // Upstream order is kept: crvUSD comes before msUSD in the feed.
    expect(await response.json()).toStrictEqual([crvUsdServed, msUsdServed]);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch.mock.calls[0][0]).toBe(
      "https://api.stakedao.org/api/strategies/v2/curve/1.json",
    );
  });

  it("accepts lowercase gauges and returns checksummed ones", async function () {
    const response = await requestStrategies(
      `chainId=1&gauges=${msUsdGauge.toLowerCase()}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual([msUsdServed]);
  });

  it("drops reward tokens without a symbol", async function () {
    const response = await requestStrategies(
      "chainId=1&gauges=0x6d3328F0333f6FB0B2FaC87cF5a0FFa7e77beB60",
    );

    expect(await response.json()).toStrictEqual([
      {
        apr: { current: { total: 0.02 } },
        gaugeAddress: "0x6d3328F0333f6FB0B2FaC87cF5a0FFa7e77beB60",
        key: "1-0x3b6991e34dd92d574c39f085015b22e5c23e87bf",
        rewards: [{ apr: 0, end: 0, token: { symbol: "CRV" } }],
        tradingApy: 0.02,
      },
    ]);
  });

  it("serves each reward's apr and end", async function () {
    // The live VUSD entries only carry CRV at 0/0, so use the BOLD/USDC
    // rewards seen in the feed: an active BOLD and an expired LUSD.
    const rewards = [
      { apr: 0, end: 0, token: { symbol: "CRV" } },
      { apr: 3.94, end: 1791468467, token: { symbol: "BOLD" } },
      { apr: 0, end: 1747873307, token: { symbol: "LUSD" } },
    ];
    upstreamFetch.mockImplementation(
      async () =>
        new Response(JSON.stringify([{ ...liveStrategies[1], rewards }])),
    );

    const response = await requestStrategies(`chainId=1&gauges=${crvUsdGauge}`);

    expect(await response.json()).toStrictEqual([{ ...crvUsdServed, rewards }]);
  });

  it("rejects the whole batch with 400 when a gauge is not an address", async function () {
    const response = await requestStrategies(
      `chainId=1&gauges=${msUsdGauge},not-an-address`,
    );

    expect(response.status).toBe(400);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });
});
