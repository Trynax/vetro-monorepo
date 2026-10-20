---
name: react-query-use-query
description: Create, modify, or validate React Query useQuery hooks following project best practices below. Handles creating new hooks, updating existing ones, and validating hooks against standards. Use this skill whenever working with useQuery hooks, even for multiple hooks at once.
---

# React Query useQuery Hook Skill

## Overview

This skill helps you CREATE, MODIFY, and VALIDATE React Query `useQuery` hooks following the project's best practices. Use this skill whenever working with useQuery hooks, even for multiple hooks at once. It operates in three modes:

- **CREATE MODE**: Generate new hooks with proper structure, types, and fetchers when needed
- **MODIFY MODE**: Update existing hooks while preserving patterns and maintaining compliance
- **VALIDATE MODE**: Check hooks against best practices and report violations with fixes

**Scope**: Only `useQuery` hooks (not mutations)
**Target directory**: `web/src/hooks/`
**Fetchers directory**: `web/src/fetchers/`

## Best Practices Reference

These practices MUST be followed:

1. **Use @tanstack/react-query**: Custom hooks use `useQuery` and return the output directly for flexibility
2. **One file, one query**: Each file defines a single query — its `queryOptions` factory, the hook that wraps it, and an optional `[name]QueryKey` function — with only one `useQuery` call, unless input depends on other hooks
3. **Parameters**: A hook that needs one variable takes it directly (e.g. `usePoolStrategy(poolId)`). A hook that needs 2+ variables takes a single object containing them. The same applies to `queryOptions` and `[name]QueryKey` functions
4. **queryKey naming**: Keys start with a kebab-case string representing the key name, sorted from generic to specific
   - Example: `['user-balance', listVariable, detailVariable, filterVariable]`
5. **Always create a `queryOptions` function**: Create a function that returns `queryOptions({...})` from `@tanstack/react-query`. This encapsulates `queryKey`, `queryFn`, and `enabled` together. The hook then calls `useQuery(myOptions({...}))`. **Scope of use**: `queryOptions` functions are consumed only by `useQuery` and by other queries'/fetchers' `queryFn` via `queryClient.ensureQueryData(myOptions({...}))`. **Mutations must not import or call a `queryOptions` function** — when a mutation needs to invalidate or update a query's cache, it should use a separately exported `[name]QueryKey` function (see best practice 5a). Export `queryOptions` only when another query/fetcher needs it.
   - **5a. Export `[name]QueryKey` for mutation invalidation**: When a query will be invalidated or updated by a mutation, also export a standalone `[name]QueryKey({...})` function that accepts only the identity params (no `client`, no `queryClient`). Mutations call `queryClient.invalidateQueries({ queryKey: [name]QueryKey({...}) })` or `queryClient.setQueryData([name]QueryKey({...}), ...)`. Have the `queryOptions` function reuse this `queryKey` function so the key stays in one place.
6. **Always use arrays**: Use arrays for `queryKey` even if only one parameter
7. **Simple queryFn**: Keep `queryFn` simple (one inline call). Complex logic goes in `web/src/fetchers/`

## Mode Detection

Detect the mode based on user's request:

- **CREATE**: Keywords like "create", "add", "new", "implement", "build", "write" + hook/query/useQuery mention
- **MODIFY**: Keywords like "update", "modify", "change", "fix", "refactor" + existing file reference
- **VALIDATE**: Keywords like "check", "validate", "review", "lint"

## TypeScript Templates

### Template A: Simple Hook (No Dependencies)

Use when the hook doesn't depend on data from other hooks. Note: In web3/blockchain contexts, most hooks need at least a client hook (like `usePublicClient`), which would make them Template B.

```typescript
import { queryOptions, useQuery } from "@tanstack/react-query"
import type { Address } from "viem"

// Export only if used elsewhere (e.g., in fetchers via queryClient.ensureQueryData)
const [featureName]Options = ({ [params] }: { [params]: [Type] }) =>
  queryOptions({
    queryFn: () => [fetcherCall]([params]),
    queryKey: ["[kebab-case-name]", [params]],
  })

export const [hookName] = ({ [params] }: { [params]: [Type] }) =>
  useQuery([featureName]Options({ [params] }))
```

### Template B: Hook with Query Dependencies

Use when the hook's `queryFn` needs data from other queries. Instead of calling dependency hooks and passing their data down, use `queryClient.ensureQueryData(dependencyOptions())` inside `queryFn` to resolve dependent query data. Context hooks (wagmi's `usePublicClient`, `useAccount`, etc.) are still called directly since they provide React context values, not query data.

**Access the `QueryClient` via the `queryFn` context.** React Query passes a context object to `queryFn` whose `client` property is the `QueryClient`. Destructure it there instead of calling `useQueryClient()` in the hook and threading a `queryClient` param through the `queryOptions` function. Always rename it on destructure (`{ client: queryClient }`): in this codebase `client` conventionally refers to an RPC client (e.g. a viem `Client`), so leaving the `QueryClient` named `client` is confusing and collides whenever a viem `client` is also in scope.

```typescript
import { queryOptions, useQuery } from "@tanstack/react-query"
import { [dependencyOptions] } from "hooks/[dependencyHook]"

export const [featureName]Options = ({
  [contextValues],
  [params],
}: {
  [contextValues]: [Type]
  [params]: [Type]
}) =>
  queryOptions({
    // Gate on any context value that may be undefined (e.g. client, account)
    enabled: !![contextValues],
    // The QueryClient is the `client` on the queryFn context — no need to
    // call useQueryClient() or pass a queryClient param.
    async queryFn({ client: queryClient }) {
      const dependentData = await queryClient.ensureQueryData(
        [dependencyOptions]({ [relevant params] }),
      )
      return [fetcherCall]({ [params], dependentData })
    },
    queryKey: ["[kebab-case-name]", [params], [contextValues]],
  })

export const [hookName] = function ({ [params] }: { [params]: [Type] }) {
  // Context hooks (wagmi, etc.) are called directly
  const [contextValue] = [useContextHook]()

  return useQuery([featureName]Options({ [contextValues], [params] }))
}
```

### Template C: Fetcher (Complex Logic)

Use when queryFn would be too complex. Place in `web/src/fetchers/[fetcherName].ts`. Fetchers can accept `queryClient` and use `queryClient.ensureQueryData()` to read data from other queries' caches.

```typescript
import type { QueryClient } from "@tanstack/react-query"
import { someOtherOptions } from "hooks/useSomeOther"
import type { Address, Client } from "viem"

export const [fetcherName] = async function ({
  client,
  [params],
  queryClient,
}: {
  client: Client
  [params]: [Type]
  queryClient: QueryClient
}) {
  // Read cached data from another query
  const cachedValue = await queryClient.ensureQueryData(
    someOtherOptions({ [relevant params] }),
  )

  // Complex logic: multiple operations, data transformations
  return result
}
```

## Implementation Workflows

### CREATE Mode Workflow

1. **Gather Requirements** (if not provided, ask):
   - Hook name (e.g., "useMintFee")
   - Data source (e.g., gateway action, API endpoint)
   - Parameters needed (e.g., gatewayAddress, chainId)
   - Dependencies on other hooks (e.g., usePublicClient)

2. **Determine Fetcher Need**:
   - Simple call → Use Template A or B
   - Multiple operations or transformations → Create fetcher with Template C

3. **Create Fetcher** (if needed):
   - File: `web/src/fetchers/[fetcherName].ts`
   - Use proper TypeScript types
   - Accept `queryClient` if it needs to read other queries' caches
   - Handle multiple async operations
   - Return transformed data

4. **Create Hook**:
   - File: `web/src/hooks/[hookName].ts`
   - Generate a `queryOptions` function (export only when another query/fetcher needs it)
   - If the query is invalidated/updated by any mutation, also export a `[name]QueryKey` function and reuse it inside `[name]Options`
   - Use correct template based on dependencies
   - Apply proper TypeScript types
   - Add `enabled` conditions for optional dependencies

### MODIFY Mode Workflow

1. **Read Existing Hook**: Use Read tool to get current implementation
2. **Identify Changes**: Understand what needs modification
3. **Preserve Patterns**: Keep existing naming conventions and structure
4. **Ensure queryOptions**: Maintain or add a `queryOptions` function (export only when another query/fetcher needs it)
5. **Re-validate**: Check against all best practices
6. **Apply Changes**: Use Edit tool for precise modifications

### VALIDATE Mode Workflow

1. **Read Hook File(s)**: Read specified files or scan `web/src/hooks/`
2. **Check Each Practice**:
   - ✓ Import from '@tanstack/react-query'
   - ✓ Returns `useQuery` result directly
   - ✓ One `useQuery` per file
   - ✓ One variable passed directly, or a single object for 2+ variables
   - ✓ queryKey array starts with kebab-case string
   - ✓ queryKey ordered generic to specific
   - ✓ `queryOptions` function exists (exported only when another query/fetcher needs it)
   - ✓ Hook calls `useQuery([name]Options({...}))`
   - ✓ queryFn reads the `QueryClient` from its context (`queryFn({ client: queryClient })`), not a threaded `queryClient` param or `useQueryClient()`
   - ✓ queryFn is simple inline call
3. **Report Violations**: List issues with line references
4. **Suggest Fixes**: Provide specific code changes

## Naming Conventions

| Element             | Pattern                         | Example                 |
| ------------------- | ------------------------------- | ----------------------- |
| Hook name           | `use[Feature][Action]`          | `useMintFee`            |
| Options function    | `[feature][Action]Options`      | `mintFeeOptions`        |
| QueryKey function   | `[feature][Action]QueryKey`     | `stakedBalanceQueryKey` |
| Fetcher name        | `fetch[Feature][Action]`        | `fetchUserPortfolio`    |
| Query key string    | `[feature]-[action]` kebab-case | `'mint-fee'`            |
| File name (hook)    | `use[Feature][Action].ts`       | `useMintFee.ts`         |
| File name (fetcher) | `fetch[Feature][Action].ts`     | `fetchUserPortfolio.ts` |

## Examples

### Example 1: Hook with queryOptions and Custom Select Support

```typescript
// File: web/src/hooks/useMintFee.ts
import {
  type UseQueryOptions,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";
import { getMintFee } from "@vetro-protocol/gateway/actions";
import type { Address, Client } from "viem";

import { useEthereumClient } from "hooks/useEthereumClient";

type QueryOptions<TSelect = bigint> = Omit<
  UseQueryOptions<bigint, Error, TSelect>,
  "enabled" | "queryFn" | "queryKey"
>;

export const mintFeeOptions = <TSelect = bigint>({
  client,
  gatewayAddress,
  token,
  ...options
}: {
  client: Client | undefined;
  gatewayAddress: Address;
  token: Address;
} & QueryOptions<TSelect>) =>
  queryOptions({
    ...options,
    enabled: !!client,
    queryFn: () => getMintFee(client!, { address: gatewayAddress, token }),
    queryKey: ["mint-fee", client?.chain?.id, gatewayAddress, token],
  });

export const useMintFee = function <TSelect = bigint>({
  gatewayAddress,
  token,
  ...options
}: {
  gatewayAddress: Address;
  token: Address;
} & QueryOptions<TSelect>) {
  const client = useEthereumClient();

  return useQuery(
    mintFeeOptions({
      ...options,
      client,
      gatewayAddress,
      token,
    }),
  );
};
```

### Example 2: Fetcher using queryClient.ensureQueryData

```typescript
// File: web/src/fetchers/fetchTotalMintFees.ts
import { estimateFeesQueryOptions } from "@hemilabs/react-hooks/useEstimateFees";
import type { QueryClient } from "@tanstack/react-query";
import { mintFeeOptions } from "hooks/useMintFee";
import { mintGasUnitsOptions } from "hooks/useSwapMintFees";
import { tokenPricesOptions } from "hooks/useTokenPrices";
import type { Token } from "types";
import { applyBps } from "utils/fees";
import { type Address, type Chain, type Client, formatUnits } from "viem";

export const fetchTotalMintFees = async function ({
  amount,
  chain,
  client,
  fromToken,
  gatewayAddress,
  owner,
  queryClient,
}: {
  amount: bigint;
  chain: Chain;
  client: Client;
  fromToken: Token;
  gatewayAddress: Address;
  owner: Address;
  queryClient: QueryClient;
}) {
  // Reuse other queries via ensureQueryData — reads from cache if available
  const gasUnits = await queryClient.ensureQueryData(
    mintGasUnitsOptions({
      amount,
      chainId: chain.id,
      client,
      fromToken,
      owner,
    }),
  );

  const [networkFeeWei, protocolFeeBps, prices] = await Promise.all([
    queryClient.ensureQueryData(
      estimateFeesQueryOptions({ chainId: chain.id, gasUnits }),
    ),
    queryClient.ensureQueryData(
      mintFeeOptions({
        client,
        gatewayAddress,
        token: fromToken.address,
      }),
    ),
    queryClient.ensureQueryData(tokenPricesOptions()),
  ]);

  // Combine and return calculated result
  return calculateTotalFees(networkFeeWei, protocolFeeBps, prices);
};
```

### Example 3: Simple queryOptions Hook

```typescript
// File: web/src/hooks/useTokenPrices.ts
import {
  type UseQueryOptions,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";
import fetch from "fetch-plus-plus";
import { isValidUrl } from "utils/url";

const apiUrl = import.meta.env.VITE_PORTAL_API_URL;

type Prices = Record<string, string>;

type QueryOptions<TSelect = Prices> = Omit<
  UseQueryOptions<Prices, Error, TSelect>,
  "queryKey" | "queryFn"
>;

export const tokenPricesOptions = <TSelect = Prices>(
  options: QueryOptions<TSelect> = {} as QueryOptions<TSelect>,
) =>
  queryOptions({
    enabled: apiUrl !== undefined && isValidUrl(apiUrl),
    queryFn: () =>
      fetch(`${apiUrl}/prices`).then(({ prices }) => prices as Prices),
    queryKey: ["token-price"] as const,
    refetchInterval: 60 * 1000,
    ...options,
  });

export const useTokenPrices = <TSelect = Prices>(
  options: QueryOptions<TSelect> = {} as QueryOptions<TSelect>,
) => useQuery(tokenPricesOptions(options));
```

## Validation Checklist

Use this checklist when validating hooks:

- [ ] Import `queryOptions` and `useQuery` from '@tanstack/react-query'
- [ ] Hook returns `useQuery` result directly (not destructured)
- [ ] Only one `useQuery` per file (or dependencies justified)
- [ ] One variable passed directly, or a single object with typed properties for 2+ variables
- [ ] `queryKey` is an array starting with kebab-case string
- [ ] `queryKey` ordered generic to specific
- [ ] `queryOptions` function exists (named `[featureName]Options`; exported only when another query/fetcher needs it)
- [ ] Hook calls `useQuery([name]Options({...}))` — not inline `useQuery({...})`
- [ ] When `queryFn` needs the `QueryClient`, it reads it from the queryFn context (`async queryFn({ client: queryClient })`) — not via a threaded `queryClient` param or `useQueryClient()` in the hook
- [ ] If the query is invalidated/updated by any mutation, a standalone `[name]QueryKey` function is also exported and reused inside `[name]Options`
- [ ] `queryFn` is single inline call (or fetcher created for complex logic)
- [ ] Proper TypeScript types (import from 'viem', etc.)
- [ ] Proper `enabled` conditions for optional dependencies
- [ ] File named: `use[Feature][Action].ts`

## Edge Cases & Guidelines

### When to Create a Fetcher

Create a fetcher in `web/src/fetchers/` when:

- Need multiple async operations that are run in sequence (one depends on another)
- Data transformation/mapping required
- Complex conditional logic
- Multiple API/contract calls that need to be combined or processed
- Need to compose data from multiple queries via `queryClient.ensureQueryData()`

Keep `queryFn` simple when:

- Single contract read
- Single API call
- Direct data return with no transformation
- Only a few independent calls that can run all in parallel (e.g., `Promise.all([call1(), call2()])` with simple return)

### Fetcher Composition with queryClient

Fetchers can accept `queryClient: QueryClient` and use `queryClient.ensureQueryData(someOptions({...}))` to read data from other queries' caches. This avoids prop drilling and enables cache deduplication:

```typescript
// Instead of passing `tokenPrice` as a parameter:
const prices = await queryClient.ensureQueryData(tokenPricesOptions());
```

> **Footgun:** `ensureQueryData` bypasses `enabled` — it always runs
> `queryFn` when data isn't cached, regardless of `enabled: false`. A
> `queryOptions` factory's `enabled: !!client` guard does **not** protect
> against `ensureQueryData` calling it with undefined inputs. Fetchers
> composing via `ensureQueryData` must validate required inputs themselves
> (assert/throw early) rather than relying on `enabled`.

### Handling Optional Parameters

Use `enabled` condition in the `queryOptions` function:

```typescript
export const myOptions = ({ value }: { value: string | undefined }) =>
  queryOptions({
    enabled: !!value,
    queryFn: () => fetchData(value!),
    queryKey: ["my-data", value],
  });
```

### Dependent Queries

When a query depends on data from another query, use `queryClient.ensureQueryData()` inside `queryFn` instead of calling the dependency hook. Get the `QueryClient` from the `queryFn` context's `client` property — there's no need to call `useQueryClient()` or pass a `queryClient` param:

```typescript
export const myOptions = () =>
  queryOptions({
    queryFn: async ({ client: queryClient }) => {
      const dependency = await queryClient.ensureQueryData(
        dependencyOptions({
          /* params */
        }),
      );
      return fetchData({ dependency });
    },
    queryKey: ["my-data"],
  });

export const useMyData = function () {
  return useQuery(myOptions());
};
```

### Exporting a queryKey Function for Mutations

`queryOptions` factories carry `queryFn`, `enabled`, and the params they need to build them (e.g. `client`). A mutation that only needs to invalidate or update a query's cache should not have to construct any of that. When a query is going to be invalidated or updated by a mutation, export a standalone `[name]QueryKey` function from the hook file and have the `queryOptions` function call it so the key lives in one place:

```typescript
export const stakedBalanceQueryKey = ({
  account,
  chainId,
  stakingVaultAddress,
}: {
  account: Address;
  chainId: number;
  stakingVaultAddress: Address;
}) => ["staked-balance", chainId, stakingVaultAddress, account];

export const stakedBalanceQueryOptions = ({
  account,
  chainId,
  client,
  stakingVaultAddress,
}: {
  account: Address | undefined;
  chainId: number;
  client: Client | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: !!client && !!account,
    // The QueryClient comes from the queryFn context, not a param.
    async queryFn({ client: queryClient }) {
      /* ...queryClient.ensureQueryData(...) */
    },
    queryKey: stakedBalanceQueryKey({
      account: account!,
      chainId,
      stakingVaultAddress,
    }),
  });
```

A mutation then invalidates with the key alone — no `client`, no `queryClient` plumbing:

```typescript
queryClient.invalidateQueries({
  queryKey: stakedBalanceQueryKey({ account, chainId, stakingVaultAddress }),
});
```

**Do not** have mutations import `stakedBalanceQueryOptions(...).queryKey` as a shortcut — it forces the mutation to pass every option-only param just to derive a key.

### Custom Select Support

When a hook needs to support custom `select` transformations, use a generic `QueryOptions` type:

```typescript
type QueryOptions<TSelect = MyType> = Omit<
  UseQueryOptions<MyType, Error, TSelect>,
  "enabled" | "queryFn" | "queryKey"
>;

export const myOptions = <TSelect = MyType>({
  param,
  ...options
}: { param: string } & QueryOptions<TSelect>) =>
  queryOptions({
    ...options,
    queryFn: () => fetchData(param),
    queryKey: ["my-data", param],
  });
```

### Error Handling

- **Don't add custom error handling**: React Query handles errors via its return values
- Users can destructure `{ error, isError }` from the hook
- Let React Query manage retry logic

### Query Options

- **Don't set `staleTime`** unless user explicitly requests it
- **Don't set `refetchInterval`** unless user explicitly requests it
- **Do set `enabled`** for conditional queries with dependencies

### Common Dependencies

**Context hooks** (called directly in the hook body, values passed to `queryOptions`):

- `usePublicClient()`: For read operations (wagmi)
- `useWalletClient()`: For write operations, not in useQuery (wagmi)
- `useAccount()`: For user address (wagmi)
- `useChainId()`: For current chain (wagmi)

**Query dependencies** (other queries whose data this query needs) are accessed via `queryClient.ensureQueryData(otherOptions({...}))` inside `queryFn`. Get the `QueryClient` from the `queryFn` context (`async queryFn({ client: queryClient }) { ... }`) rather than calling `useQueryClient()` in the hook and threading a `queryClient` param through `queryOptions`. Never call dependency hooks (e.g. `useOtherQuery()`) from within a hook that wraps a `useQuery` — import the dependency's exported `queryOptions` function instead.

### Common Types

Import from `viem`:

```typescript
import type { Address, PublicClient, WalletClient, Client } from "viem";
```

### Wagmi Hooks

Import from `wagmi`:

```typescript
import { usePublicClient, useAccount, useChainId } from "wagmi";
```

### Base URL Imports

The project has baseUrl configured in tsconfig, which allows importing from configured paths without relative paths.

**ALWAYS use clean imports:**

```typescript
// ✓ Correct - use baseUrl imports
import { fetchUserPortfolio } from "fetchers/fetchUserPortfolio";
import { useMintFee } from "hooks/useMintFee";

// ✗ Wrong - don't use relative paths
import { fetchUserPortfolio } from "../fetchers/fetchUserPortfolio";
import { useMintFee } from "./useMintFee";
```

## Instructions for Agent

When this skill is invoked:

1. **Detect Mode**: Identify whether this is CREATE, MODIFY, or VALIDATE based on user request

2. **CREATE Mode**:
   - Ask for missing information (hook name, data source, parameters, dependencies)
   - Determine if fetcher is needed
   - Create fetcher file first if needed at `web/src/fetchers/[name].ts`
   - Create hook file at `web/src/hooks/[hookName].ts`
   - Always create a `queryOptions` function (export only when another query/fetcher needs it)
   - Hook must call `useQuery([name]Options({...}))`
   - Follow template structure
   - Ensure all best practices are met
   - Use proper naming conventions
   - Apply project code style

3. **MODIFY Mode**:
   - Read the existing hook file
   - Understand requested changes
   - Preserve existing patterns
   - Make minimal changes
   - If hook uses inline `useQuery({...})`, refactor to use `queryOptions` function
   - Ensure compliance with best practices
   - Re-validate after changes

4. **VALIDATE Mode**:
   - Read specified file(s) or scan hooks directory
   - Check against all 7 best practices
   - Flag hooks that use inline `useQuery({...})` without a `queryOptions` function
   - Report violations with file:line references
   - Suggest specific fixes with code examples
   - Provide severity (error vs warning)

5. **Always**:
   - Use Read tool before Write/Edit
   - Use proper TypeScript types
   - Follow project style (semicolons, double quotes — enforced by Prettier)
   - Create a `queryOptions` function (export only when another query/fetcher needs it)
   - Export a `[name]QueryKey` function whenever mutations will invalidate or update the query

## Example Invocations

**CREATE Examples**:

- "Create a hook for getting mint fee from gateway"
- "Add a hook that fetches user balance with address and gateway address"
- "Create useRedeemFee hook"

**MODIFY Examples**:

- "Update useMintFee to also accept chainId parameter"
- "Change useUserBalance to use a fetcher instead"
- "Extract queryOptions from useGatewayInfo"

**VALIDATE Examples**:

- "Validate all hooks in web/src/hooks/"
- "Check if useMintFee follows best practices"
- "Review useUserBalance and suggest improvements"
