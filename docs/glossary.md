# VETRO Glossary

Core vocabulary for this repo. These concepts recur across `web/` and the API. For full per-page flows and how the pieces fit together, read [`DOMAIN.md`](./DOMAIN.md).

The protocol is built from **roles**, not fixed tokens. Symbols like `VUSD`, `sVUSD`, `vetBTC`, `svetBTC` are concrete _instances_ of these roles; `VUSD` is the canonical example only because it shipped first. Prefer the generic role (`peggedToken`, `shareToken`, `whitelistedToken`) over hardcoding a symbol.

Where the active instances come from:

- **Pegged tokens** are read **on-chain**: each gateway exposes its pegged token (`getPeggedToken`); the app iterates the configured `gatewayAddresses` (`packages/gateway`) and reads each one.
- **Share tokens** are the staking vaults (`stakingVaultAddresses`, `packages/earn`); each vault's underlying pegged token is read on-chain.
- **Bridgeable tokens** — the set whitelisted on the Bridge page — are the one static list that defines membership: `web/src/utils/bridgeableTokens.ts`.
- `web/src/utils/tokenList.ts` (`knownTokens`) is **not** a source of truth for what's enabled — it's a hardcoded cache of ERC-20 metadata (symbol, decimals, logo) used to load token display data quickly.

**Pegged token** (`peggedToken`) — The base 1:1 token a gateway issues against whitelisted collateral; over-collateralized; holds no yield by itself. Canonical instance `VUSD`; `vetBTC` is another.

**Whitelisted token** — A token a gateway accepts as collateral to mint its pegged token, and pays out on redeem (e.g. approved stablecoins for a USD gateway, BTC-class assets for a BTC gateway). Read on-chain from the gateway's **Treasury** via `getWhitelistedTokens` (`packages/treasury`).

**Share token** / staking token (`shareToken`, `isVaultShare: true`) — ERC-4626 vault share received by staking a pegged token on Earn; grows in value as yield accrues (price-per-share rises), so it redeems for more pegged token over time. Canonical instance `sVUSD`; `svetBTC` is another.

**Gateway** — Contract that mints a pegged token from whitelisted collateral and processes its redemptions. One gateway per pegged unit. Package: `@vetro-protocol/gateway`.

**Treasury** — Per-pegged-token contract that holds the whitelisted collateral and decides what to do with it (routing it into yield-bearing strategies). Redemptions are paid from it; backing is surfaced on Analytics.

**Collateralization ratio** — Backing value ÷ pegged tokens in circulation. Above 100% means over-collateralized.

**Mint / swap in** — Deposit a whitelisted token, receive that gateway's pegged token (Swap page).

**Redeem / swap out** — Return a pegged token, receive a whitelisted token. Goes through the two-step Redeem Queue, or a one-step instant redeem when the queue is skipped (see Redeem Queue).

**Redeem Queue** — Two-step redeem: send to queue → short security cooldown (seconds, anti-MEV) → redeem to the chosen whitelisted token. A queued redeem can be cancelled. Skipped (one-step instant) when the gateway delay is disabled or the address is instant-redeem whitelisted.

**Stake** — Deposit a pegged token into its staking vault to mint the share token and earn yield (Earn page). Package: `@vetro-protocol/earn`.

**Cooldown** — Waiting period before funds become withdrawable. The Earn unstake cooldown is multi-day and read on-chain (`getCooldownDuration`); funds in cooldown earn no yield. The Swap redeem cooldown is seconds.

**Exit ticket** — An unstake request sitting in cooldown on Earn. States: cooldown → ready → withdrawn (or cancelled if the ticket is deleted). Deleting puts funds back to staked.

**Target-yield vault** — An ERC-8416 vault that takes a pegged token and pays a target rate for a fixed term (Earn → Target Yield). Deposits and withdrawals are asynchronous (ERC-7540). Canonical instance `VUSDx`, over `VUSD`.

**Keeper** — An off-chain operator on the vault's keeper list. It starts each epoch and fulfills deposit and withdrawal requests. Users must wait for it before they can claim.

**Epoch** — One fixed-rate term of a target-yield vault. It has an id (starts at `1`; `0` means no epoch yet), a target rate, a deposit cap, and three windows. A keeper starts each epoch. Its values do not change after it starts. The epoch end is the maturity.

**Entry window** — The part of an epoch when users can request a deposit. It starts at the epoch start.

**Accrual interval** — The part of an epoch when interest accrues, at the epoch's target rate. It ends at the maturity.

**Exit window** — The part of an epoch when users can request a withdrawal. It ends at the maturity. If a user misses it, the funds stay in the vault for one more epoch.

**Maturity** — The end of an epoch. Interest stops. From this time, the keeper can fulfill withdrawal requests.

**Limbo** — The gap between the end of one epoch and the start of the next. No interest accrues, and users cannot request a deposit or a withdrawal. `epochId()` still returns the epoch that ended.

**Target rate** — The rate of an epoch. It is a simple annual rate (APR), and it applies only during the accrual interval. It is a target, not a guarantee.

**Fulfillment / claim** — The steps after a target-yield request. The keeper fulfills a request, and then the user claims it. `deposit`/`mint` claim shares, and `redeem`/`withdraw` claim the pegged token.

**Borrow / CDP** — Deposit crypto collateral (e.g. hemiBTC, WETH) and borrow a pegged token (VUSD today) against it via Morpho Blue, without selling the crypto.

**Health factor** — Borrow position safety score. Above 1.0 is safe; at or below 1.0 the position can be liquidated.

**LTV** — Loan-to-value: debt ÷ collateral value.

**Liquidation** — When the health factor reaches 1.0, collateral is sold to repay the debt plus a penalty paid to liquidators.

**Bridge / OFT** — Move a token across chains via LayerZero's Omnichain Fungible Token standard; the same token is native on many chains, with no wrapping.

**Pages** — Swap (mint/redeem) · Earn (stake for yield) · Borrow (CDP) · Bridge (cross-chain) · Analytics (proof-of-reserves dashboard).
