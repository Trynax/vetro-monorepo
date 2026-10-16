# @vetro-protocol/target-yield-earn

Vetro Protocol target-yield earning vault actions for viem clients. The vault is an epoch-based ERC-7540 async vault over a pegged token (`VUSDx` over `VUSD` being the first instance): each epoch is a fixed term carrying a target yield, not a guaranteed return.

## Installation

```sh
npm add @vetro-protocol/target-yield-earn viem
```

## Overview

- Deposits and redemptions are asynchronous following ERC-7540.
- The vault runs in epochs. Each epoch is a term with its own target APR, a max deposit cap, and an exit window at its end during which redeem requests are accepted. `getEpochId` returns the current epoch (`0n` when none has started yet).
- The APR is a target, not a promise. It's set per epoch before that epoch starts and applies only to that term — nothing commits the vault to it beyond the current epoch — and the owner can terminate the vault once an epoch ends, after which yield stops accruing for good.
- A request is either pending (`pendingDepositRequest`) or claimable (`claimableDepositRequest`), never both. A new deposit request or a redeem request claims a claimable one first.
- `minEpochDurationSeconds`, `minExitWindowSeconds` and `maxExitWindowSeconds` mirror the vault's hardcoded values. They're exported as seconds.

## Usage

```ts
import {
  claimableDepositRequest,
  getCancelableDepositRequest,
  getEpoch,
  getEpochId,
  getMaxRequestDeposit,
  getMaxRequestRedeem,
  maxMint,
  pendingDepositRequest,
} from "@vetro-protocol/target-yield-earn/actions";
import { createPublicClient, http } from "viem";
import { hemi } from "viem/chains";

const publicClient = createPublicClient({ chain: hemi, transport: http() });

const vaultAddress = "0x...";

// Current epoch, or 0n if the vault hasn't started one yet.
const epochId = await getEpochId(publicClient, { address: vaultAddress });

// Full epoch: rate, deposit cap and windows as absolute timestamps.
const epoch = await getEpoch(publicClient, { address: vaultAddress, epochId });

// Max amount of assets this owner can still request for deposit.
const maxAssets = await getMaxRequestDeposit(publicClient, {
  address: vaultAddress,
  controller: "0x...",
  owner: "0x...",
});

// Max amount of shares this owner can still request for redemption.
const maxShares = await getMaxRequestRedeem(publicClient, {
  address: vaultAddress,
  controller: "0x...",
  owner: "0x...",
});

// Assets requested for deposit that the keeper hasn't fulfilled yet.
const pendingAssets = await pendingDepositRequest(publicClient, {
  address: vaultAddress,
  controller: "0x...",
});

// Assets of a pending deposit request that the controller can cancel now.
const cancelableAssets = await getCancelableDepositRequest(publicClient, {
  address: vaultAddress,
  controller: "0x...",
});

// Assets of a fulfilled deposit request, ready to claim.
const claimableAssets = await claimableDepositRequest(publicClient, {
  address: vaultAddress,
  controller: "0x...",
});

// Shares the controller gets when it claims. 0n while the vault is shut down.
const claimableShares = await maxMint(publicClient, {
  address: vaultAddress,
  controller: "0x...",
});
```

## API

- Public actions (reads):
  - `claimableDepositRequest(client, { address, controller })` — assets in a fulfilled deposit request that the controller can claim.
  - `getCancelableDepositRequest(client, { address, controller })` — assets in the controller's deposit request that `cancelDepositRequest` can refund now. `0n` when there is no request or the request is fulfilled. A request from the current epoch is cancelable only during the entry window. A request from an earlier epoch is always cancelable until fulfillment.
  - `getEpoch(client, params)` — an epoch's `start`, `end`, `rate`, `maxDeposits` (the deposit cap), `deposits` (the assets requested so far) and its `entryWindow`, `accrualInterval` and `exitWindow` as `{ end, start }` absolute timestamps.
  - `getEpochId(client, params)` — the current epoch id, `0n` when no epoch has started.
  - `getIsPaused(client, params)` — whether the keeper paused the vault. Pausing blocks new deposit requests only.
  - `getIsShutdown(client, params)` — whether the owner shut the vault down. Shutdown blocks every request and claim, but not cancellations. Reversible.
  - `getIsTerminated(client, params)` — whether the vault was permanently wound down. Once terminated, no new epochs or deposits, and withdrawal requests are claimable right away.
  - `getMaxRequestDeposit(client, { address, controller, owner })` — the assets the owner can still request for deposit, capped by the epoch's remaining deposit capacity. `0n` whenever a deposit request would revert — outside the entry window, while paused, shutdown or terminated, when the owner has no entry access, or when the controller has a pending request from an earlier epoch.
  - `getMaxRequestRedeem(client, { address, controller, owner })` — the shares the owner can still request for redemption. `0n` whenever a redeem request would revert — outside the exit window, while shutdown, or when a redeem batch from an earlier epoch is still pending and the vault hasn't terminated.
  - `getRate(client, params)` — the fixed rate an epoch pays during its accrual interval, WAD-scaled per annum. It returns the same value at any time, so use it (or `getEpoch`) to show the rate.
  - `maxMint(client, { address, controller })` — the shares a claim of the controller's fulfilled deposit request mints. It wraps `maxMint` from `viem-erc4626`, which calls this argument `receiver`. `0n` while the vault is shut down, because claims revert then.
  - `pendingDepositRequest(client, { address, controller })` — assets in an unfulfilled deposit request.
- Wallet actions (writes), exported from `/actions` only. All of them return `{ emitter, promise }`:
  - `cancelDepositRequest(walletClient, { address, controller })` — cancels the controller's unfulfilled deposit request. The vault sends the assets back to the controller. Allowed only while `getCancelableDepositRequest` is above `0n`.
  - `cancelRedeemRequest(walletClient, { address, controller })` — cancels the controller's unfulfilled redeem request. The vault sends the escrowed shares back to the controller. Allowed only during the exit window of the epoch of the request.
  - Both cancel actions are specific to VUSDx. ERC-8416 does not define them.
  - `claimDeposit(walletClient, { address, assets, controller, receiver? })` — claims the controller's fulfilled deposit request with the ERC-7540 `deposit(assets, receiver, controller)`, which mints the shares to `receiver`. `receiver` defaults to `controller`. Pass `maxUint256` as `assets` to claim the full claimable amount. The claim goes by assets, not shares, because a claim by shares (`mint`) can leave dust in the request. Before it writes, it reads the vault and emits `claim-deposit-failed-validation` when the vault is shut down, when the account is not the controller or its operator, when there is no claimable deposit, or when `assets` is more than `maxDeposit(controller)`.
  - `encodeCancelDepositRequest(params)`, `encodeCancelRedeemRequest(params)` and `encodeClaimDeposit(params)` — return the calldata for the call without sending anything.
  - `requestDeposit(walletClient, { address, approveAmount?, assets, controller, owner })` — requests a deposit. It reads the pegged token from the vault's `asset()` and approves it first if the owner's allowance is lower than `assets`. `approveAmount` defaults to `assets`.
  - `requestRedeem(walletClient, { address, controller, owner, shares })` — requests a redemption.
- `targetYieldEarnPublicActions()` — viem extension factory that wires the public actions onto a client via `.extend()`.
- `targetYieldEarnVaultAbi` — the minimal ABI subset used by the package.
- Constants: `maxExitWindowSeconds`, `minEpochDurationSeconds`, `minExitWindowSeconds`.
