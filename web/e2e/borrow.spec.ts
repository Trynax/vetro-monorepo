import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import type { MarketId } from "@morpho-org/blue-sdk";
import { fetchPosition } from "@morpho-org/blue-sdk-viem";
import { type Page, expect } from "@playwright/test";
import { type PublicClient, formatUnits, parseUnits } from "viem";
import { getBlock } from "viem/actions";
import { balanceOf } from "viem-erc20/actions";

import { openBorrowPosition } from "../scripts/openBorrowPosition.ts";
import { marketIds } from "../src/constants/borrow.ts";
import { formatNumber } from "../src/utils/format.ts";

import { ANVIL_URL, createEthereumClient } from "./anvil";
import { test } from "./fixtures/wallet";
import { getMainnetToken, waitForBalance } from "./helpers";

const hemiBtc = getMainnetToken("hemiBTC");
const vusd = getMainnetToken("VUSD");
const hemiBtcVusdMarketId = marketIds[0] as MarketId;
const COLLATERAL_DISPLAY = "0.05";
const COLLATERAL_AMOUNT = parseUnits(COLLATERAL_DISPLAY, hemiBtc.decimals);
const BORROW_DISPLAY = "1000";
const BORROW_AMOUNT = parseUnits(BORROW_DISPLAY, vusd.decimals);
const BORROW_MORE_DISPLAY = "500";
const BORROW_MORE_AMOUNT = parseUnits(BORROW_MORE_DISPLAY, vusd.decimals);
const SUPPLY_MORE_DISPLAY = "0.02";
const SUPPLY_MORE_AMOUNT = parseUnits(SUPPLY_MORE_DISPLAY, hemiBtc.decimals);
// Partial on purpose: the form has no max button, and a full repay by assets
// would race the interest accrued per block.
const REPAY_DISPLAY = "400";
const REPAY_AMOUNT = parseUnits(REPAY_DISPLAY, vusd.decimals);

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The loan cell adds the interest accrued since the borrow, so the decimals
// are not fixed.
const loanCellText = (display: string) =>
  new RegExp(
    `^${escapeRegExp(formatNumber(display))}(\\.\\d+)? ${escapeRegExp(vusd.symbol)}$`,
  );
const collateralCellText = (display: string) =>
  new RegExp(
    `^${escapeRegExp(formatNumber(display))} ${escapeRegExp(hemiBtc.symbol)}$`,
  );

async function openPositionsPage({
  client,
  page,
}: {
  client: PublicClient;
  page: Page;
}) {
  await openBorrowPosition({
    address: TEST_ADDRESS,
    borrowAmount: BORROW_DISPLAY,
    collateralAmount: COLLATERAL_DISPLAY,
    forkUrl: ANVIL_URL,
    marketId: hemiBtcVusdMarketId,
  });

  // The seed moves the fork ahead of wall time; the app accrues to Date.now.
  const { timestamp: chainNow } = await getBlock(client);
  await page.clock.install({ time: Number(chainNow) * 1000 });

  await page.goto("/borrow");

  await expect(
    page.getByRole("button", { name: /^0x[a-f0-9]{4}/i }),
  ).toBeVisible({ timeout: 30_000 });
}

function getPositionRow(page: Page) {
  const row = page
    .locator("#borrow-positions tr")
    .filter({ has: page.locator(`#manage-${hemiBtcVusdMarketId}`) });
  const positionCells = row.locator("td");
  const healthFactorCell = positionCells.nth(2);
  const ltvCell = positionCells.nth(4).locator("span").first();

  async function readHealthFactorAndLtv() {
    await expect(healthFactorCell).toHaveText(/^\d+\.\d{2}$/);
    await expect(ltvCell).toHaveText(/%$/);
    return {
      healthFactor: parseFloat(await healthFactorCell.innerText()),
      ltv: parseFloat(await ltvCell.innerText()),
    };
  }

  return { readHealthFactorAndLtv, row };
}

async function openManageAction({
  action,
  page,
}: {
  action: string;
  page: Page;
}) {
  await page.locator(`#manage-${hemiBtcVusdMarketId}`).click();
  await page.getByRole("menuitem", { name: action }).click();
  return page.getByRole("heading", { name: action }).locator("..");
}

test("start a borrow position on the hemiBTC / VUSD market", async function ({
  page,
}) {
  const publicClient = createEthereumClient();

  const [hemiBtcBefore, vusdBefore] = await Promise.all([
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: hemiBtc.address,
    }),
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    }),
  ]);

  await page.goto(`/borrow/${hemiBtcVusdMarketId}`);

  await expect(
    page.getByRole("button", { name: /^0x[a-f0-9]{4}/i }),
  ).toBeVisible({ timeout: 30_000 });

  const amountInputs = page.locator('input[type="text"]:not([disabled])');
  await amountInputs.nth(0).fill(COLLATERAL_DISPLAY);
  await amountInputs.nth(1).fill(BORROW_DISPLAY);

  const submitButton = page.getByRole("button", {
    name: "Supply collateral and borrow",
  });
  await expect(submitButton).toBeEnabled({ timeout: 20_000 });
  await submitButton.click();

  await expect(page.getByText("Borrow successful")).toBeVisible({
    timeout: 60_000,
  });

  await expect(page.getByText("You have a position already open")).toBeVisible({
    timeout: 20_000,
  });

  await waitForBalance({ client: publicClient, token: vusd.address }).toBe(
    vusdBefore + BORROW_AMOUNT,
  );

  const hemiBtcAfter = await balanceOf(publicClient, {
    account: TEST_ADDRESS,
    address: hemiBtc.address,
  });
  expect(hemiBtcAfter).toBe(hemiBtcBefore - COLLATERAL_AMOUNT);

  const position = await fetchPosition(
    TEST_ADDRESS,
    hemiBtcVusdMarketId,
    publicClient,
  );
  expect(position.collateral).toBe(COLLATERAL_AMOUNT);
  expect(position.borrowShares).toBeGreaterThan(0n);

  await page.getByRole("link", { name: "View positions" }).click();

  const positions = page.locator("#borrow-positions");
  await expect(
    positions.getByText(collateralCellText(COLLATERAL_DISPLAY)),
  ).toBeVisible({ timeout: 30_000 });

  await expect(positions.getByText(loanCellText(BORROW_DISPLAY))).toBeVisible();

  await expect(
    positions.locator(`#manage-${hemiBtcVusdMarketId}`),
  ).toBeVisible();
});

test("borrow more on an open hemiBTC / VUSD position", async function ({
  page,
}) {
  const publicClient = createEthereumClient();

  await openPositionsPage({ client: publicClient, page });

  const [vusdBefore, positionBefore] = await Promise.all([
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    }),
    fetchPosition(TEST_ADDRESS, hemiBtcVusdMarketId, publicClient),
  ]);

  const { readHealthFactorAndLtv, row } = getPositionRow(page);

  await expect(row.getByText(loanCellText(BORROW_DISPLAY))).toBeVisible({
    timeout: 30_000,
  });
  const before = await readHealthFactorAndLtv();

  const drawer = await openManageAction({ action: "Borrow more", page });
  await drawer
    .locator('input[type="text"]:not([disabled])')
    .fill(BORROW_MORE_DISPLAY);

  const submitButton = drawer.getByRole("button", {
    exact: true,
    name: "Borrow",
  });
  await expect(submitButton).toBeEnabled({ timeout: 20_000 });
  await submitButton.click();

  await expect(page.getByText("Borrow successful")).toBeVisible({
    timeout: 60_000,
  });

  await waitForBalance({ client: publicClient, token: vusd.address }).toBe(
    vusdBefore + BORROW_MORE_AMOUNT,
  );

  const positionAfter = await fetchPosition(
    TEST_ADDRESS,
    hemiBtcVusdMarketId,
    publicClient,
  );
  expect(positionAfter.collateral).toBe(COLLATERAL_AMOUNT);
  expect(positionAfter.borrowShares).toBeGreaterThan(
    positionBefore.borrowShares,
  );

  const totalBorrowDisplay = formatUnits(
    BORROW_AMOUNT + BORROW_MORE_AMOUNT,
    vusd.decimals,
  );
  await expect(row.getByText(loanCellText(totalBorrowDisplay))).toBeVisible({
    timeout: 30_000,
  });

  const after = await readHealthFactorAndLtv();
  expect(after.healthFactor).toBeLessThan(before.healthFactor);
  expect(after.ltv).toBeGreaterThan(before.ltv);
});

test("supply more collateral to an open hemiBTC / VUSD position", async function ({
  page,
}) {
  const publicClient = createEthereumClient();

  await openPositionsPage({ client: publicClient, page });

  const [hemiBtcBefore, positionBefore] = await Promise.all([
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: hemiBtc.address,
    }),
    fetchPosition(TEST_ADDRESS, hemiBtcVusdMarketId, publicClient),
  ]);

  const { readHealthFactorAndLtv, row } = getPositionRow(page);

  await expect(
    row.getByText(collateralCellText(COLLATERAL_DISPLAY)),
  ).toBeVisible({ timeout: 30_000 });
  const before = await readHealthFactorAndLtv();

  const drawer = await openManageAction({
    action: "Supply more collateral",
    page,
  });
  await drawer
    .locator('input[type="text"]:not([disabled])')
    .fill(SUPPLY_MORE_DISPLAY);

  const submitButton = drawer.getByRole("button", {
    exact: true,
    name: "Supply collateral",
  });
  await expect(submitButton).toBeEnabled({ timeout: 20_000 });
  await submitButton.click();

  await expect(page.getByText("Collateral supplied")).toBeVisible({
    timeout: 60_000,
  });

  await waitForBalance({ client: publicClient, token: hemiBtc.address }).toBe(
    hemiBtcBefore - SUPPLY_MORE_AMOUNT,
  );

  const positionAfter = await fetchPosition(
    TEST_ADDRESS,
    hemiBtcVusdMarketId,
    publicClient,
  );
  expect(positionAfter.collateral).toBe(COLLATERAL_AMOUNT + SUPPLY_MORE_AMOUNT);
  expect(positionAfter.borrowShares).toBe(positionBefore.borrowShares);

  const totalCollateralDisplay = formatUnits(
    COLLATERAL_AMOUNT + SUPPLY_MORE_AMOUNT,
    hemiBtc.decimals,
  );
  await expect(
    row.getByText(collateralCellText(totalCollateralDisplay)),
  ).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText(loanCellText(BORROW_DISPLAY))).toBeVisible();

  const after = await readHealthFactorAndLtv();
  expect(after.healthFactor).toBeGreaterThan(before.healthFactor);
  expect(after.ltv).toBeLessThan(before.ltv);
});

test("repay part of the loan on an open hemiBTC / VUSD position", async function ({
  page,
}) {
  const publicClient = createEthereumClient();

  await openPositionsPage({ client: publicClient, page });

  const [vusdBefore, positionBefore] = await Promise.all([
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    }),
    fetchPosition(TEST_ADDRESS, hemiBtcVusdMarketId, publicClient),
  ]);

  const { readHealthFactorAndLtv, row } = getPositionRow(page);

  await expect(row.getByText(loanCellText(BORROW_DISPLAY))).toBeVisible({
    timeout: 30_000,
  });
  const before = await readHealthFactorAndLtv();

  const drawer = await openManageAction({ action: "Repay loan", page });
  await drawer
    .locator('input[type="text"]:not([disabled])')
    .fill(REPAY_DISPLAY);

  const submitButton = drawer.getByRole("button", {
    exact: true,
    name: "Repay",
  });
  await expect(submitButton).toBeEnabled({ timeout: 20_000 });
  await submitButton.click();

  await expect(page.getByText("Loan repaid")).toBeVisible({
    timeout: 60_000,
  });

  await waitForBalance({ client: publicClient, token: vusd.address }).toBe(
    vusdBefore - REPAY_AMOUNT,
  );

  const positionAfter = await fetchPosition(
    TEST_ADDRESS,
    hemiBtcVusdMarketId,
    publicClient,
  );
  expect(positionAfter.collateral).toBe(COLLATERAL_AMOUNT);
  expect(positionAfter.borrowShares).toBeLessThan(positionBefore.borrowShares);

  const remainingBorrowDisplay = formatUnits(
    BORROW_AMOUNT - REPAY_AMOUNT,
    vusd.decimals,
  );
  await expect(row.getByText(loanCellText(remainingBorrowDisplay))).toBeVisible(
    { timeout: 30_000 },
  );

  const after = await readHealthFactorAndLtv();
  expect(after.healthFactor).toBeGreaterThan(before.healthFactor);
  expect(after.ltv).toBeLessThan(before.ltv);
});
