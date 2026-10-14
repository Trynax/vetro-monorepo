# @vetro-protocol/earn

Vetro Protocol staking-vault actions for viem clients. Wraps the `sVUSD` and `sVetBTC` ERC-4626 vaults with their deposit, cooldown, and withdraw flows.

## Installation

```sh
pnpm add @vetro-protocol/earn viem viem-erc20
```

## Overview

- Targets the two whitelisted staking vaults — `sVUSD` and `sVetBTC` — exported as `sVusdAddress`, `sVetBtcAddress`, and the combined `stakingVaultAddresses` list.
- `deposit` runs the full ERC-4626 deposit: on-chain allowance check, approval if needed, then `deposit(assets, receiver)`. Each step emits through an `EventEmitter`.
- Withdrawals follow the vault's cooldown protocol: `requestRedeem` / `requestWithdraw` opens a cooldown, `claimWithdraw` / `claimWithdrawBatch` finalises it once the cooldown elapses, and `cancelWithdraw` aborts an open request.
- Read actions (`getCooldownDuration`, `getCooldownEnabled`, `getInstantWithdrawWhitelist`, `getPendingRequests`, `getActiveRequestIds`, `getClaimableRequests`, `getRequestDetails`, `getTotalAssetsInCooldown`, `getYieldDistributor`) cover the data needed to drive a UI around the flows above.

## Usage

```ts
import {
  deposit,
  getPendingRequests,
  sVusdAddress,
} from "@vetro-protocol/earn";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { hemi } from "viem/chains";

const publicClient = createPublicClient({ chain: hemi, transport: http() });
const walletClient = createWalletClient({
  chain: hemi,
  transport: custom(window.ethereum),
});

// Stake VUSD into sVUSD (approval handled automatically).
const { emitter, promise } = deposit(walletClient, {
  assets: 1_000_000_000_000_000_000n,
  receiver: "0x...",
  token: "0x...", // underlying VUSD address
  vaultAddress: sVusdAddress,
});

emitter.on("user-signed-deposit", (hash) => console.log("tx hash:", hash));
emitter.on("deposit-transaction-succeeded", (receipt) =>
  console.log("deposited:", receipt),
);

await promise;

// Inspect any pending withdraw requests for the user.
const pending = await getPendingRequests(publicClient, {
  account: "0x...",
  address: sVusdAddress,
});
```

The same actions are also available via `.extend()` factories (`earnPublicActions()`, `earnWalletActions()`) for callers who prefer viem's extension pattern.

## API

- Public actions (reads):
  - `getActiveRequestIds(client, params)` — open withdraw request IDs for an account.
  - `getClaimableRequests(client, params)` — request IDs whose cooldown has elapsed.
  - `getCooldownDuration(client, params)` — cooldown length in seconds.
  - `getCooldownEnabled(client, params)` — whether the cooldown is enforced.
  - `getInstantWithdrawWhitelist(client, params)` — accounts allowed to bypass cooldown.
  - `getPendingRequests(client, params)` — full pending-request structs for an account.
  - `getRequestDetails(client, params)` — details for a specific request ID.
  - `getTotalAssetsInCooldown(client, params)` — assets locked across all pending requests.
  - `getYieldDistributor(client, params)` — address of the vault's yield distributor.
- Wallet actions (writes): `deposit`, `requestRedeem`, `requestWithdraw`, `claimWithdraw`, `claimWithdrawBatch`, `cancelWithdraw`. Each returns `{ emitter, promise }`.
- Calldata encoders, exported from `/actions`: each returns the calldata of one write without sending anything, so a caller can sign and broadcast it elsewhere, or batch it into a multicall:
  - `encodeCancelWithdraw({ requestId })` — `cancelWithdraw(requestId)`.
  - `encodeClaimWithdraw({ receiver, requestId })` — `claimWithdraw(requestId, receiver)`.
  - `encodeClaimWithdrawBatch({ receiver, requestIds })` — `claimWithdrawBatch(requestIds, receiver)`.
  - `encodeDeposit({ assets, receiver })` — `deposit(assets, receiver)`. Unlike `deposit`, it does not approve the pegged token first.
  - `encodeRequestRedeem({ owner, shares })` — `requestRedeem(shares, owner)`.
  - `encodeRequestWithdraw({ assets, owner })` — `requestWithdraw(assets, owner)`.
- `earnPublicActions()` / `earnWalletActions()` — viem extension factories that wire the same actions onto a client via `.extend()`.
- `stakingVaultAbi` — the minimal ABI subset used by the package.
- Constants: `sVusdAddress`, `sVetBtcAddress`, `stakingVaultAddresses`.
- Types: `CancelWithdrawEvents`, `ClaimWithdrawBatchEvents`, `ClaimWithdrawEvents`, `CooldownRequest`, `DepositEvents`, `RequestRedeemEvents`, `RequestWithdrawEvents`.
