import { TEST_ADDRESS } from "@hemilabs/anvil-fork-setup/utils";
import { type Page, expect } from "@playwright/test";
import {
  stakingVaultAbi,
  sVetBtcAddress,
  sVusdAddress,
} from "@vetro-protocol/earn";
import {
  getActiveRequestIds,
  getCooldownEnabled,
} from "@vetro-protocol/earn/actions";
import {
  type Address,
  type TransactionReceipt,
  erc20Abi,
  formatUnits,
  isAddressEqual,
  parseAbiItem,
  parseEventLogs,
  parseUnits,
} from "viem";
import {
  getBlock,
  getTransactionReceipt,
  waitForTransactionReceipt,
  writeContract,
} from "viem/actions";
import { approve, balanceOf } from "viem-erc20/actions";

import { fastForwardTime } from "../scripts/fastForwardTime.ts";
import { setCooldownEnabled } from "../scripts/setCooldownEnabled.ts";
import { whitelistInstantWithdraw } from "../scripts/whitelistInstantWithdraw.ts";
import type { ExitTicket } from "../src/pages/earn/types.ts";
import { formatNumber } from "../src/utils/format.ts";

import {
  ANVIL_URL,
  createEthereumClient,
  createTestWalletClient,
} from "./anvil";
import { test } from "./fixtures/wallet";
import { getMainnetToken, waitForBalance } from "./helpers";

const vusd = getMainnetToken("VUSD");
const sVusd = getMainnetToken("sVUSD");
const vetBtc = getMainnetToken("vetBTC");
const DEPOSIT_DISPLAY = "5";
const DEPOSIT_AMOUNT = parseUnits(DEPOSIT_DISPLAY, vusd.decimals);

// The StakingVault ABI has no claim event, so a claim's payout is read from the
// standard ERC-20 Transfer(to = receiver) logs on the token being paid out.
const sumTransfersTo = ({
  receipt,
  token,
}: {
  receipt: TransactionReceipt;
  token: Address;
}) =>
  parseEventLogs({
    abi: erc20Abi,
    args: { to: TEST_ADDRESS },
    eventName: "Transfer",
    logs: receipt.logs,
  })
    .filter((log) => isAddressEqual(log.address, token))
    .reduce((sum, log) => sum + log.args.value, 0n);

// The VUSD pool is the sVUSD ERC-4626 vault. A deposit emits the standard
// ERC-4626 Deposit(sender, owner, assets, shares); `shares` is exactly the
// sVUSD minted to the receiver, so we read it straight off the deposit tx.
const depositEvent = parseAbiItem(
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
);

async function openVusdPoolDetails(page: Page) {
  await page.goto("/earn");

  // The mock wallet auto-connects silently via EIP-6963 (see fixtures/wallet),
  // so just wait for the header button to switch from "Connect wallet" to the
  // 0x… short address — don't open the RainbowKit connect modal.
  await expect(
    page.getByRole("button", { name: /^0x[a-f0-9]{4}/i }),
  ).toBeVisible({ timeout: 30_000 });

  const vusdPool = page
    .locator("div")
    .filter({ has: page.getByText("VUSD", { exact: true }) })
    .filter({ has: page.getByRole("link", { name: "Pool details" }) })
    .last();
  await vusdPool.getByRole("link", { name: "Pool details" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: /variable yield/i }),
  ).toBeVisible();
}

async function expectPositionShares({
  page,
  shares,
}: {
  page: Page;
  shares: bigint;
}) {
  const positionCard = page
    .locator("div")
    .filter({ has: page.getByText("Your position", { exact: true }) })
    .filter({ has: page.getByText(sVusd.symbol) })
    .last();
  await expect(
    positionCard.getByText(
      `${formatNumber(formatUnits(shares, sVusd.decimals))} ${sVusd.symbol}`,
    ),
  ).toBeVisible({ timeout: 20_000 });
}

test("deposit VUSD into the Earn pool", async function ({
  page,
  walletTxHashes,
}) {
  const publicClient = createEthereumClient();

  const [vusdBefore, svusdBefore] = await Promise.all([
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    }),
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: sVusdAddress,
    }),
  ]);

  await openVusdPoolDetails(page);

  await page
    .locator('input[type="text"]:not([disabled])')
    .first()
    .fill(DEPOSIT_DISPLAY);

  // Per-test snapshot/revert resets the allowance to 0, so the deposit takes the
  // two-tx path: the submit button reads "Approve and deposit". The mock wallet
  // signs both txs (approve, then deposit) with no popups.
  //
  // Dispatch the click straight to the button rather than a coordinate click:
  // the ApproveSection's info-icon tooltip (rc-tooltip, placement="top") in the
  // CollapsibleSection just below renders its overlay directly over this button,
  // and in CI it swallows the pointer events so a normal .click() never lands and
  // the test times out. dispatchEvent bypasses hit-testing and triggers the
  // form's submit handler directly; await the enabled state first so we don't
  // submit before balances load (the form's onSubmit no-ops while inputError set).
  const submitButton = page.getByRole("button", {
    name: /approve and deposit/i,
  });
  await expect(submitButton).toBeEnabled();
  await submitButton.dispatchEvent("click");

  // The success toast renders once both txs confirm on the fork (60s budget to
  // cover the two sequential signatures + confirmations).
  await expect(page.getByText("Stake deposit confirmed")).toBeVisible({
    timeout: 60_000,
  });

  // Check input resets to "0" on success
  await expect(
    page.locator('input[type="text"]:not([disabled])').first(),
  ).toHaveValue("0");

  // Assertion 1 — VUSD balance dropped by exactly the deposited amount.
  await waitForBalance({ client: publicClient, token: vusd.address }).toBe(
    vusdBefore - DEPOSIT_AMOUNT,
  );

  // Assertion 2 — read how many sVUSD were minted straight from the deposit tx.
  // The mock wallet sends approve then deposit, so walletTxHashes ends with the
  // deposit; its receipt carries the vault's ERC-4626 Deposit event, whose
  // `shares` is exactly the sVUSD minted to us — no block-range scan, no summing.
  const depositTxHash = walletTxHashes.at(-1);
  expect(depositTxHash).toBeDefined();
  const receipt = await getTransactionReceipt(publicClient, {
    hash: depositTxHash!,
  });
  const depositLogs = parseEventLogs({
    abi: [depositEvent],
    args: { owner: TEST_ADDRESS },
    eventName: "Deposit",
    logs: receipt.logs,
  });
  expect(depositLogs).toHaveLength(1);
  const svusdMinted = depositLogs[0].args.shares;
  expect(svusdMinted).toBeGreaterThan(0n);

  const svusdAfter = await balanceOf(publicClient, {
    account: TEST_ADDRESS,
    address: sVusdAddress,
  });
  expect(svusdAfter - svusdBefore).toBe(svusdMinted);

  await expect(
    page.getByRole("heading", { name: "Deposit in progress" }),
  ).toBeHidden({ timeout: 15_000 });

  await expectPositionShares({ page, shares: svusdAfter });

  await page.goto("/earn");
  await expect(
    page.getByRole("button", { name: /^0x[a-f0-9]{4}/i }),
  ).toBeVisible({ timeout: 30_000 });

  const fromPoolsBadge = page.getByText(/from 1 pool/i);
  await expect(fromPoolsBadge).toBeVisible({ timeout: 20_000 });

  await fromPoolsBadge.hover();
  await expect(page.getByText(/\([\d.,]+\s*VUSD\)/)).toBeVisible({
    timeout: 10_000,
  });
});

const WITHDRAW_DISPLAY = "3";
const WITHDRAW_AMOUNT = parseUnits(WITHDRAW_DISPLAY, vusd.decimals);

// The instant (one-step) withdraw is a plain ERC-4626 withdraw, which emits the
// standard Withdraw(sender, receiver, owner, assets, shares). `assets` is the
// VUSD paid out to the receiver and `shares` the sVUSD burned — both read
// straight off the withdraw tx, no block-range scan.
const withdrawEvent = parseAbiItem(
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
);

// Give the test account a real staked position by actually depositing the
// vault's pegged token (approve + deposit) as the test account, signing directly
// against Anvil rather than through the browser mock wallet.
async function stake({
  assets,
  token,
  vaultAddress,
}: {
  assets: bigint;
  token: Address;
  vaultAddress: Address;
}) {
  const walletClient = createTestWalletClient();

  const approvalHash = await approve(walletClient, {
    address: token,
    amount: assets,
    spender: vaultAddress,
  });
  await waitForTransactionReceipt(walletClient, { hash: approvalHash });

  const depositHash = await writeContract(walletClient, {
    abi: stakingVaultAbi,
    address: vaultAddress,
    args: [assets, TEST_ADDRESS],
    functionName: "deposit",
  });
  const receipt = await waitForTransactionReceipt(walletClient, {
    hash: depositHash,
  });
  expect(receipt.status).toBe("success");
}

test("withdraw VUSD from the Earn pool (whitelisted one-step exit)", async function ({
  page,
  walletTxHashes,
}) {
  const publicClient = createEthereumClient();

  await stake({
    assets: DEPOSIT_AMOUNT,
    token: vusd.address,
    vaultAddress: sVusdAddress,
  });
  await whitelistInstantWithdraw({ address: TEST_ADDRESS, forkUrl: ANVIL_URL });

  const [vusdBefore, svusdBefore] = await Promise.all([
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    }),
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: sVusdAddress,
    }),
  ]);

  await openVusdPoolDetails(page);

  await page.getByRole("button", { exact: true, name: "Withdraw" }).click();

  await page
    .locator('input[type="text"]:not([disabled])')
    .first()
    .fill(WITHDRAW_DISPLAY);

  await expect(
    page.getByRole("button", { name: "Request withdrawal" }),
  ).toBeHidden();
  const submitButton = page
    .locator("form")
    .getByRole("button", { exact: true, name: "Withdraw" });
  await expect(submitButton).toBeEnabled();
  await submitButton.dispatchEvent("click");

  await expect(page.getByText("Withdrawal complete")).toBeVisible({
    timeout: 40_000,
  });

  // Check input resets to "0" on success
  await expect(
    page.locator('input[type="text"]:not([disabled])').first(),
  ).toHaveValue("0");

  const withdrawTxHash = walletTxHashes.at(-1);
  expect(withdrawTxHash).toBeDefined();
  const receipt = await getTransactionReceipt(publicClient, {
    hash: withdrawTxHash!,
  });
  const withdrawLogs = parseEventLogs({
    abi: [withdrawEvent],
    args: { owner: TEST_ADDRESS },
    eventName: "Withdraw",
    logs: receipt.logs,
  });
  expect(withdrawLogs).toHaveLength(1);
  const { assets: vusdWithdrawn, shares: svusdBurned } = withdrawLogs[0].args;
  expect(vusdWithdrawn).toBe(WITHDRAW_AMOUNT);
  expect(svusdBurned).toBeGreaterThan(0n);

  // Assertion — VUSD balance rose by exactly the withdrawn assets and sVUSD
  // dropped by exactly the burned shares.
  await waitForBalance({ client: publicClient, token: vusd.address }).toBe(
    vusdBefore + vusdWithdrawn,
  );

  const svusdAfter = await balanceOf(publicClient, {
    account: TEST_ADDRESS,
    address: sVusdAddress,
  });
  expect(svusdBefore - svusdBurned).toBe(svusdAfter);

  await expectPositionShares({ page, shares: svusdAfter });
});

test("withdraw VUSD from the Earn pool (two-step cooldown exit)", async function ({
  page,
  walletTxHashes,
}) {
  const publicClient = createEthereumClient();

  // Seed a real staked position, then enable cooldown WITHOUT whitelisting so
  // the app takes the two-step path.
  await stake({
    assets: DEPOSIT_AMOUNT,
    token: vusd.address,
    vaultAddress: sVusdAddress,
  });
  await setCooldownEnabled({ forkUrl: ANVIL_URL });

  expect(
    await getCooldownEnabled(publicClient, { address: sVusdAddress }),
  ).toBe(true);

  const [vusdBefore, svusdBefore] = await Promise.all([
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    }),
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: sVusdAddress,
    }),
  ]);

  // Drive the exit-tickets table from a mocked API response we control (the
  // endpoint is otherwise stubbed with [] by the wallet fixture).
  let exitTicketsBody: ExitTicket[] = [];
  await page.route("**/variable-stake/exit-tickets/**", (route) =>
    route.fulfill({ json: exitTicketsBody }),
  );

  await openVusdPoolDetails(page);

  await page.getByRole("button", { exact: true, name: "Withdraw" }).click();

  // Fill the amount first: with an empty input the submit button reads "Enter an
  // amount", and only resolves to its action label once a valid amount is set.
  await page
    .locator('input[type="text"]:not([disabled])')
    .first()
    .fill(WITHDRAW_DISPLAY);

  const submitButton = page
    .locator("form")
    .getByRole("button", { name: "Request withdrawal" });
  await expect(submitButton).toBeEnabled({ timeout: 20_000 });
  // Dispatch the click to bypass the fee-section tooltip overlay in CI (see the
  // deposit test for the full rationale).
  await submitButton.dispatchEvent("click");

  await expect(page.getByText("Withdrawal request confirmed")).toBeVisible({
    timeout: 60_000,
  });

  // The progress drawer auto-closes ~2s after success.
  await expect(
    page.getByRole("heading", { name: "Withdrawal in progress" }),
  ).toBeHidden({ timeout: 15_000 });

  // Read the request tx: WithdrawRequested carries the requestId, the locked
  // shares/assets, and the on-chain claimableAt. This is the same event
  // useStakeWithdraw parses to build its optimistic ticket.
  const requestTxHash = walletTxHashes.at(-1);
  expect(requestTxHash).toBeDefined();
  const requestReceipt = await getTransactionReceipt(publicClient, {
    hash: requestTxHash!,
  });
  const requestLogs = parseEventLogs({
    abi: stakingVaultAbi,
    args: { owner: TEST_ADDRESS },
    eventName: "WithdrawRequested",
    logs: requestReceipt.logs,
  });
  expect(requestLogs).toHaveLength(1);
  const { assets, claimableAt, requestId, shares } = requestLogs[0].args;
  expect(claimableAt).toBeGreaterThan(0n);
  expect(assets).toBe(WITHDRAW_AMOUNT);
  expect(shares).toBeGreaterThan(0n);

  // Shares leave the wallet at request time; VUSD is only paid out on claim.
  const svusdAfterRequest = await balanceOf(publicClient, {
    account: TEST_ADDRESS,
    address: sVusdAddress,
  });
  expect(svusdAfterRequest).toBe(svusdBefore - shares);
  expect(
    await balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    }),
  ).toBe(vusdBefore);

  const ticket: ExitTicket = {
    assets: assets.toString(),
    claimableAt: claimableAt.toString(),
    owner: TEST_ADDRESS,
    requestId: requestId.toString(),
    requestTxHash: requestTxHash!,
    shares: shares.toString(),
    stakingVaultAddress: sVusdAddress,
  };

  // Cooldown state — mock returns the ticket with its real (future)
  // claimableAt. The exit-tickets table lives on the Earn page, not on the
  // pool's details page.
  exitTicketsBody = [ticket];
  await page.goto("/earn");
  await expect(
    page.getByRole("button", { name: /^0x[a-f0-9]{4}/i }),
  ).toBeVisible({ timeout: 30_000 });

  const exitTickets = page.locator("#exit-tickets");
  await expect(exitTickets.getByText("Cooldown in progress")).toBeVisible({
    timeout: 20_000,
  });

  // Fast-forward the fork past claimableAt so the claim tx passes the contract's
  // block.timestamp check (Gateway/vault _handleRedeemOrWithdraw).
  const { timestamp: chainNow } = await getBlock(publicClient);
  await fastForwardTime({
    forkUrl: ANVIL_URL,
    seconds: Number(claimableAt - chainNow),
  });

  // Ready state — override claimableAt to a past unix ts so getTicketStatus
  // resolves to "ready" against the real browser clock.
  exitTicketsBody = [{ ...ticket, claimableAt: "1" }];
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^0x[a-f0-9]{4}/i }),
  ).toBeVisible({ timeout: 30_000 });

  await expect(exitTickets.getByText("Ready to withdraw")).toBeVisible({
    timeout: 20_000,
  });

  // Step 2 — claim from the row. `exact` avoids matching the "Withdraw all"
  // button.
  const rowWithdrawButton = exitTickets.getByRole("button", {
    exact: true,
    name: "Withdraw",
  });
  await expect(rowWithdrawButton).toBeEnabled();
  await rowWithdrawButton.click();

  await expect(page.getByText("Withdrawal complete")).toBeVisible({
    timeout: 40_000,
  });

  // Confirm the payout against the claim tx itself: sum the VUSD transferred to
  // the receiver in the claim receipt. walletTxHashes ends with the claim tx
  // (seeding used a separate client; the only browser txs are the request then
  // the claim).
  const claimTxHash = walletTxHashes.at(-1);
  expect(claimTxHash).toBeDefined();
  const claimReceipt = await getTransactionReceipt(publicClient, {
    hash: claimTxHash!,
  });
  const vusdReceived = sumTransfersTo({
    receipt: claimReceipt,
    token: vusd.address,
  });
  expect(vusdReceived).toBeGreaterThan(0n);

  // useClaimWithdraw optimistically sets claimTxHash on the cached ticket, so the
  // row flips to "Withdrawn". Mirror that onto the mocked endpoint too, so a
  // background refetch can't overwrite the optimistic state and revert the row
  // back to "ready".
  exitTicketsBody = [
    { ...ticket, claimableAt: "1", claimTxHash: claimTxHash! },
  ];
  await expect(exitTickets.getByText("Withdrawn")).toBeVisible();

  // VUSD rose by exactly what the claim receipt paid out; sVUSD stays at its
  // post-request value (the shares were already removed at request time).
  await waitForBalance({ client: publicClient, token: vusd.address }).toBe(
    vusdBefore + vusdReceived,
  );
  expect(
    await balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: sVusdAddress,
    }),
  ).toBe(svusdAfterRequest);

  // Check the toast
  await expect(page.getByText("Withdrawal complete")).toBeVisible({
    timeout: 10_000,
  });
});

// Queue an exit ticket for the test account without going through the UI: the
// request → cooldown flow is already covered by the two-step test above, so this
// signs the request straight against Anvil and returns the WithdrawRequested
// args the exit-tickets API would have indexed.
async function requestWithdraw({
  assets,
  vaultAddress,
}: {
  assets: bigint;
  vaultAddress: Address;
}) {
  const walletClient = createTestWalletClient();

  // One block after the deposit, the gas estimate still sees a zero yield drip
  // while the mined tx sees a non-zero one — the request then runs out of gas.
  // Forwarding the clock puts both on the same side of the drip.
  await fastForwardTime({ forkUrl: ANVIL_URL, seconds: 60 });

  const requestHash = await writeContract(walletClient, {
    abi: stakingVaultAbi,
    address: vaultAddress,
    args: [assets, TEST_ADDRESS],
    functionName: "requestWithdraw",
  });
  const receipt = await waitForTransactionReceipt(walletClient, {
    hash: requestHash,
  });
  expect(receipt.status).toBe("success");

  const requestLogs = parseEventLogs({
    abi: stakingVaultAbi,
    args: { owner: TEST_ADDRESS },
    eventName: "WithdrawRequested",
    logs: receipt.logs,
  });
  expect(requestLogs).toHaveLength(1);

  return {
    ...requestLogs[0].args,
    requestTxHash: receipt.transactionHash,
  };
}

test("delete an exit ticket while it is in cooldown", async function ({
  page,
  walletTxHashes,
}) {
  const publicClient = createEthereumClient();

  // Cooldown on and no instant-withdraw whitelist, so the request lands in the
  // queue instead of paying out immediately.
  await stake({
    assets: DEPOSIT_AMOUNT,
    token: vusd.address,
    vaultAddress: sVusdAddress,
  });
  await setCooldownEnabled({ forkUrl: ANVIL_URL });

  const [vusdBefore, svusdBefore] = await Promise.all([
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    }),
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: sVusdAddress,
    }),
  ]);

  const { assets, claimableAt, requestId, requestTxHash, shares } =
    await requestWithdraw({
      assets: WITHDRAW_AMOUNT,
      vaultAddress: sVusdAddress,
    });

  // The shares left the wallet at request time — deleting the ticket has to put
  // them back.
  expect(
    await balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: sVusdAddress,
    }),
  ).toBe(svusdBefore - shares);

  // Serve the queued ticket from the mocked exit-tickets endpoint (the wallet
  // fixture otherwise stubs it with []).
  let exitTicketsBody: ExitTicket[] = [
    {
      assets: assets.toString(),
      claimableAt: claimableAt.toString(),
      owner: TEST_ADDRESS,
      requestId: requestId.toString(),
      requestTxHash,
      shares: shares.toString(),
      stakingVaultAddress: sVusdAddress,
    },
  ];
  await page.route("**/variable-stake/exit-tickets/**", (route) =>
    route.fulfill({ json: exitTicketsBody }),
  );

  await page.goto("/earn");

  await expect(
    page.getByRole("button", { name: /^0x[a-f0-9]{4}/i }),
  ).toBeVisible({ timeout: 30_000 });

  const exitTickets = page.locator("#exit-tickets");
  await expect(exitTickets.getByText("Cooldown in progress")).toBeVisible({
    timeout: 20_000,
  });

  await exitTickets.getByRole("button", { name: "Delete exit ticket" }).click();

  const deleteModal = page.getByRole("dialog", { name: "Delete exit ticket" });
  await expect(deleteModal).toBeVisible();
  await expect(
    deleteModal.getByRole("button", { name: "Cancel" }),
  ).toBeVisible();

  await deleteModal.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("Exit ticket deleted")).toBeVisible({
    timeout: 40_000,
  });
  await expect(deleteModal).toBeHidden();

  // The cancel is the only tx the browser wallet signs — the stake and the
  // request were seeded with a separate client.
  expect(walletTxHashes).toHaveLength(1);

  // useCancelWithdraw optimistically drops the ticket from the cache; mirror the
  // cancellation onto the mocked endpoint too.
  exitTicketsBody = [
    { ...exitTicketsBody[0], cancelTxHash: walletTxHashes[0] },
  ];

  // The vault dropped the request, so the table falls back to its empty state.
  const activeRequestIds = await getActiveRequestIds(publicClient, {
    account: TEST_ADDRESS,
    address: sVusdAddress,
  });
  expect(activeRequestIds).not.toContain(requestId);

  await expect(exitTickets.getByText("Request a withdrawal")).toBeVisible();

  // Cancelling re-mints convertToShares(assets) as of the cancel block rather
  // than handing back the exact share count burned at request time: the vault
  // accrued yield in between, so the same assets now buy marginally fewer
  // shares. Read what the cancel tx actually minted instead of expecting the
  // pre-request balance back to the wei.
  const cancelReceipt = await getTransactionReceipt(publicClient, {
    hash: walletTxHashes[0],
  });
  const sharesReturned = sumTransfersTo({
    receipt: cancelReceipt,
    token: sVusdAddress,
  });

  // The yield drift is dust, and never in the staker's favour.
  expect(sharesReturned).toBeLessThanOrEqual(shares);
  expect(shares - sharesReturned).toBeLessThan(shares / 1_000_000n);

  // The locked shares are back in the wallet, and no VUSD was paid out — the
  // funds went back to being staked.
  await waitForBalance({ client: publicClient, token: sVusdAddress }).toBe(
    svusdBefore - shares + sharesReturned,
  );
  expect(
    await balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    }),
  ).toBe(vusdBefore);
});

test("withdraw all the ready exit tickets", async function ({
  page,
  walletTxHashes,
}) {
  const publicClient = createEthereumClient();

  const vetBtcDepositAmount = parseUnits("2", vetBtc.decimals);
  const vetBtcTicketAmount = parseUnits("1", vetBtc.decimals);
  const firstVusdTicketAmount = parseUnits("2", vusd.decimals);
  const secondVusdTicketAmount = parseUnits("1", vusd.decimals);
  const cooldownVusdTicketAmount = parseUnits("1", vusd.decimals);

  // Seed a staked position in both pools, with cooldown on and no
  // instant-withdraw whitelist so every request lands in the queue as a ticket.
  await stake({
    assets: DEPOSIT_AMOUNT,
    token: vusd.address,
    vaultAddress: sVusdAddress,
  });
  await stake({
    assets: vetBtcDepositAmount,
    token: vetBtc.address,
    vaultAddress: sVetBtcAddress,
  });
  await setCooldownEnabled({ forkUrl: ANVIL_URL, vaultAddress: sVusdAddress });
  await setCooldownEnabled({
    forkUrl: ANVIL_URL,
    vaultAddress: sVetBtcAddress,
  });

  const [vusdBefore, vetBtcBefore] = await Promise.all([
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vusd.address,
    }),
    balanceOf(publicClient, {
      account: TEST_ADDRESS,
      address: vetBtc.address,
    }),
  ]);

  // Two tickets on the VUSD pool and one on the vetBTC pool: "Withdraw all"
  // groups the ready tickets by vault, so this is one claim tx per pool — not
  // one per ticket. Requests are sequential to keep the nonces in order.
  const firstVusdRequest = await requestWithdraw({
    assets: firstVusdTicketAmount,
    vaultAddress: sVusdAddress,
  });
  const secondVusdRequest = await requestWithdraw({
    assets: secondVusdTicketAmount,
    vaultAddress: sVusdAddress,
  });
  const vetBtcRequest = await requestWithdraw({
    assets: vetBtcTicketAmount,
    vaultAddress: sVetBtcAddress,
  });
  // A fourth ticket kept in cooldown below — "Withdraw all" must leave it alone.
  const cooldownRequest = await requestWithdraw({
    assets: cooldownVusdTicketAmount,
    vaultAddress: sVusdAddress,
  });

  // Fast-forward the fork past the latest claimableAt (the pools have different
  // cooldown durations) so both claim txs pass the vault's block.timestamp
  // check. This makes the fourth request claimable on-chain too: it stays out of
  // the flow purely because the UI still shows it as in cooldown.
  const { timestamp: chainNow } = await getBlock(publicClient);
  const latestClaimableAt = [
    firstVusdRequest,
    secondVusdRequest,
    vetBtcRequest,
    cooldownRequest,
  ]
    .map((request) => request.claimableAt)
    .reduce((latest, claimableAt) =>
      claimableAt > latest ? claimableAt : latest,
    );
  await fastForwardTime({
    forkUrl: ANVIL_URL,
    seconds: Number(latestClaimableAt - chainNow),
  });

  // Serve the four tickets from the mocked exit-tickets endpoint (the wallet
  // fixture otherwise stubs it with []). getTicketStatus compares claimableAt
  // against the browser clock, which the fast-forward above left untouched:
  // "1" (a past unix ts) renders as ready, and the request's real claimableAt —
  // a cooldown away from when the fork was seeded — renders as in cooldown.
  const toTicket = ({
    claimableAt,
    request,
    stakingVaultAddress,
  }: {
    claimableAt: string;
    request: Awaited<ReturnType<typeof requestWithdraw>>;
    stakingVaultAddress: Address;
  }): ExitTicket => ({
    assets: request.assets.toString(),
    claimableAt,
    owner: TEST_ADDRESS,
    requestId: request.requestId.toString(),
    requestTxHash: request.requestTxHash,
    shares: request.shares.toString(),
    stakingVaultAddress,
  });

  let exitTicketsBody: ExitTicket[] = [
    toTicket({
      claimableAt: "1",
      request: firstVusdRequest,
      stakingVaultAddress: sVusdAddress,
    }),
    toTicket({
      claimableAt: "1",
      request: secondVusdRequest,
      stakingVaultAddress: sVusdAddress,
    }),
    toTicket({
      claimableAt: "1",
      request: vetBtcRequest,
      stakingVaultAddress: sVetBtcAddress,
    }),
    toTicket({
      claimableAt: cooldownRequest.claimableAt.toString(),
      request: cooldownRequest,
      stakingVaultAddress: sVusdAddress,
    }),
  ];
  await page.route("**/variable-stake/exit-tickets/**", (route) =>
    route.fulfill({ json: exitTicketsBody }),
  );

  await page.goto("/earn");

  await expect(
    page.getByRole("button", { name: /^0x[a-f0-9]{4}/i }),
  ).toBeVisible({ timeout: 30_000 });

  const exitTickets = page.locator("#exit-tickets");
  await expect(exitTickets.getByText("Ready to withdraw")).toHaveCount(3, {
    timeout: 20_000,
  });
  await expect(exitTickets.getByText("Cooldown in progress")).toHaveCount(1);

  // The badge counts only the ready tickets, so the one in cooldown is excluded.
  const withdrawAllButton = exitTickets.getByRole("button", {
    name: /withdraw all/i,
  });
  await expect(withdrawAllButton).toHaveText(/withdraw all\s*3/i);
  await expect(withdrawAllButton).toBeEnabled();
  await withdrawAllButton.click();

  // The progress drawer lists one step per pool, each labelled with the pegged
  // token read from the vault on-chain.
  await expect(
    page.getByRole("heading", { name: "Withdrawing all exit tickets" }),
  ).toBeVisible();
  await expect(page.getByText("Confirm VUSD withdrawal")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Confirm vetBTC withdrawal")).toBeVisible();

  await expect(page.getByText("All exit tickets withdrawn")).toBeVisible({
    timeout: 60_000,
  });

  expect(walletTxHashes).toHaveLength(2);
  const [vusdClaimReceipt, vetBtcClaimReceipt] = await Promise.all(
    walletTxHashes.map((hash) => getTransactionReceipt(publicClient, { hash })),
  );
  expect(isAddressEqual(vusdClaimReceipt.to!, sVusdAddress)).toBe(true);
  expect(isAddressEqual(vetBtcClaimReceipt.to!, sVetBtcAddress)).toBe(true);

  // useClaimWithdrawBatch optimistically sets claimTxHash on each claimed
  // ticket, so their rows flip to "Withdrawn". Mirror that onto the mocked
  // endpoint as soon as the hashes are known, so a background refetch can't
  // revert them back to "ready" while the assertions below run.
  exitTicketsBody = exitTicketsBody.map((ticket) =>
    ticket.claimableAt === "1"
      ? {
          ...ticket,
          claimTxHash: isAddressEqual(ticket.stakingVaultAddress, sVusdAddress)
            ? vusdClaimReceipt.transactionHash
            : vetBtcClaimReceipt.transactionHash,
        }
      : ticket,
  );

  const vusdReceived = sumTransfersTo({
    receipt: vusdClaimReceipt,
    token: vusd.address,
  });
  expect(vusdReceived).toBe(firstVusdTicketAmount + secondVusdTicketAmount);
  const vetBtcReceived = sumTransfersTo({
    receipt: vetBtcClaimReceipt,
    token: vetBtc.address,
  });
  expect(vetBtcReceived).toBe(vetBtcTicketAmount);

  await waitForBalance({ client: publicClient, token: vusd.address }).toBe(
    vusdBefore + vusdReceived,
  );
  await waitForBalance({ client: publicClient, token: vetBtc.address }).toBe(
    vetBtcBefore + vetBtcReceived,
  );

  // The ticket left in cooldown is the only request the vault still holds.
  expect(
    await getActiveRequestIds(publicClient, {
      account: TEST_ADDRESS,
      address: sVusdAddress,
    }),
  ).toEqual([cooldownRequest.requestId]);
  expect(
    await getActiveRequestIds(publicClient, {
      account: TEST_ADDRESS,
      address: sVetBtcAddress,
    }),
  ).toEqual([]);

  await expect(
    page.getByRole("heading", { name: "Withdrawing all exit tickets" }),
  ).toBeHidden({ timeout: 15_000 });

  await expect(exitTickets.getByText("Withdrawn")).toHaveCount(3);
  await expect(exitTickets.getByText("Cooldown in progress")).toHaveCount(1);
});
