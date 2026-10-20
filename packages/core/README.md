# @vetro-protocol/core

Shared building blocks and small utilities used across the Vetro Protocol packages and apps that would otherwise be copied into every package.

## Installation

This package is private to this monorepo — not published to npm. Depend on it with `workspace:*`:

```json
{ "dependencies": { "@vetro-protocol/core": "workspace:*" } }
```

## Usage

Example usage:

```ts
import { isAddressValid, knownTokens, type Token } from "@vetro-protocol/core";
import { mainnet } from "viem/chains";

const usdc: Token | undefined = knownTokens.find(
  (token) => token.chainId === mainnet.id && token.symbol === "USDC",
);

if (!isAddressValid(usdc?.address)) {
  throw new Error("USDC is missing from the token list");
}
```

## API Reference

### `Token`

ERC-20 metadata shared by the apps. `extensions` carries optional per-token hints:

| Field                           | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `allowanceSlot` / `balanceSlot` | Storage slots, used to seed balances on a fork  |
| `isVaultShare`                  | Price via the ERC-4626 vault's underlying asset |
| `priceSymbol`                   | Symbol to price this token under                |

### `DexPool`

A DEX pool that holds VETRO tokens.

Related types:

| Type             | Purpose                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| `DexPoolRange`   | The price range of a concentrated-liquidity range row (`range` on `DexPool`) |
| `DexPoolReward`  | A reward on a pool. `source` selects the shape of `sourceMetadata`           |
| `DexRewardToken` | A token paid by a `DexPoolReward`                                            |

### `knownTokens`

`Token[]`.

A hardcoded list of known ERC-20 metadata (symbol, decimals, logo) used to render token display data without a network round-trip.

Entries span every chain the app touches, so filter by `chainId` before using it against a single-chain client.

### `stakingVaultAddresses`

`sVusdAddress`, `sVetBtcAddress` and the `stakingVaultAddresses` array.

### `gateways`

`Gateway[]`, plus the derived `gatewayAddresses` array. Both live in `src/protocolGraph.ts`.

The protocol graph on Ethereum mainnet, hand-maintained: per gateway, its Portal-API `pegBaseSymbol`, its pegged token, its treasury, its whitelisted tokens, and its `stakingVault` when the pegged token has one. Gateways are not discovered on chain, so a new gateway needs an entry here and a deployment.

`gatewayAddresses[0]` means "the VUSD gateway" used by default sometimes, so the VUSD gateway stays first.

### `isAddressValid`

```ts
isAddressValid(address: Address | undefined): address is Address;
```

Narrows to `Address`, rejecting `undefined`, malformed values, failed checksums, and the zero address.

### `updateRpcUrls`

```ts
updateRpcUrls(chain: Chain, rpcUrlEnv?: string): Chain;
```

Overrides a chain's default RPC URLs from an env var holding a single URL, or several joined by `+`. Invalid entries are dropped; if none are left, the chain is returned untouched.

### `createRpcTransport`

```ts
createRpcTransport(chain: Chain): FallbackTransport | HttpTransport;
```

Builds a chain's transport from its configured RPC URLs: several URLs become a viem `fallback` transport, so a failing or rate-limited endpoint rolls over to the next one; a single URL becomes a plain `http` transport. Both batch concurrent calls into one JSON-RPC request.

### `createMainnetClient`

```ts
createMainnetClient(rpcUrl: string | undefined): PublicClient;
```

An Ethereum mainnet public client built from `updateRpcUrls` + `createRpcTransport`, with Multicall3 read aggregation enabled.
