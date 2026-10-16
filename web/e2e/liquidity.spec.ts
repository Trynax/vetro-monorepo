import { type Page, expect, test } from "@playwright/test";
import type { DexPool } from "@vetro-protocol/core";

import { getMainnetToken } from "./helpers";

const usdc = getMainnetToken("USDC").address;
const vusd = getMainnetToken("VUSD").address;

// Each merkl reward renders an sr-only label, which is absolutely positioned.
// Enough of them overflow the viewport, which is what used to stretch the
// document and add a second window scrollbar.
const pools: DexPool[] = Array.from({ length: 10 }, function (_, index) {
  const id = (index + 1).toString(16);
  return {
    address: `0x${id.padStart(40, "0")}`,
    apr: 0.05,
    chainId: 1,
    coins: [
      { address: vusd, amount: 1_000_000 },
      { address: usdc, amount: 1_000_000 },
    ],
    dex: "uniswap",
    rewards: [
      {
        apr: 0.02,
        source: "merkl",
        sourceMetadata: {
          campaignId: `0x${id.padStart(64, "0")}`,
          opportunityId: id,
        },
        tokens: [{ address: vusd, chainId: 1 }],
      },
    ],
    tvlUsd: 2_000_000 - index * 1_000,
    volumeUsd24h: 50_000,
  };
});

const getContainerScrollableHeight = (page: Page) =>
  page
    .locator("main")
    .evaluate((main) =>
      main.parentElement
        ? main.parentElement.scrollHeight - main.parentElement.clientHeight
        : 0,
    );

const getWindowScrollableHeight = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );

for (const viewport of [
  { height: 700, width: 1440 },
  { height: 700, width: 400 },
]) {
  test(`the liquidity page only scrolls inside the app container at ${viewport.width}x${viewport.height}`, async function ({
    page,
  }) {
    await page.route("**/liquidity/pools", (route) =>
      route.fulfill({ json: pools }),
    );
    await page.setViewportSize(viewport);
    // The page-in animation transforms main, which contains the absolute
    // labels while it runs and would hide the bug.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en/liquidity");

    await expect(
      page.getByRole("link", { name: "Add liquidity" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Add liquidity" })).toHaveCount(
      pools.length,
    );

    // Without overflow in the container, the window check proves nothing.
    expect(await getContainerScrollableHeight(page)).toBeGreaterThan(0);
    await expect.poll(() => getWindowScrollableHeight(page)).toBe(0);
  });
}
