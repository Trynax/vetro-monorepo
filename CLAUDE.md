# Domain

VETRO is a protocol for minting and managing pegged tokens and putting them to work for yield.
The `web/` app exposes the Swap, Earn, Borrow, Bridge, and Analytics pages. The glossary below is always available; when working on a specific feature, read `docs/DOMAIN.md` for the full per-page flows.

@docs/glossary.md

## Coding Conventions

### CSS

- Use tailwind v4 classes
- If setting width and height to the same value (like `w-2 h-2`), use the alternative class `size-*`. For example: `size-2`.
- **Minimum supported width**: 400px. Layouts must not overflow at 400px or above. Do not check smaller viewports.

### JavaScript/TypeScript

- **Alphabetical sorting**: Sort object properties, function parameters, imports and types properties alphabetically
- **Function declarations**: Use full function expressions, not arrow functions. Exception: single-expression arrow functions with implicit returns are allowed (e.g., `const foo = () => 0;` or `array.filter(element => element > 45)`)
- **Variable naming**: Use camelCase for variables
- **Function parameters**: Use an object for functions requiring 2+ parameters. Exception: facade/adapter functions may maintain their original signature
- **Comparing addresses**: When comparing `Address` values (the type from `viem`), prefer `isAddressEqual` imported from `viem` over direct equality checks
- **Actions over client extension**: Call actions in the standalone `actionFn(client, params)` form instead of decorating the client via `.extend()`. This applies to both viem's native actions (e.g. `readContract(client, params)`) and our `@vetro-protocol/*` package actions (import from the package's `/actions` subpath). Keep the client plain. This yields simpler types — the `Client` type stays lean instead of accumulating every extended action — and lets bundlers tree-shake the actions you don't call.
- **Comments**: Explain only the non-obvious "why", not what the code does. Update comments or docstrings that your change makes stale.
- **Fix sibling code**: When fixing a bug or extracting a shared helper/component, apply the same change to sibling code with the same pattern. If that's out of scope, list the remaining gaps in the PR description.
- **Export on demand**: Don't export types or helpers until a consumer needs them.

### TypeScript

- **Array syntax**: Prefer `T[]` over `Array<T>`
- **Avoid `as any`**: Only use as a last resort when alternatives are significantly more complex
- **Expected errors**: Use `@ts-expect-error [explanation]` instead of `as any` for known type issues
- **Return types**: Omit explicit return types when the compiler can infer them
- **Type vs Interface**: Prefer `type` over `interface`, except for module augmentation
- **Running TypeScript files**: Use `node <path/to/file>.ts` directly — Node natively supports TypeScript execution
- **Component Props naming**: When creating a type for component props, use generic name `Props` if they're the only props defined in the file. Otherwise, use `<ComponentName>Props`

### Tests

- **Assert exact values**: Compare against an independently computed value (e.g. read the contract directly), not shape-only checks like `toMatch(/^\d+$/)`, which also pass on `0` or a decimals mixup.

### Packages (`packages/`)

- **Contract address param**: Name the target contract's param `address` in new actions, as viem does. Some older actions use `vaultAddress`/`gatewayAddress`/`oftAddress`; don't copy those names.
- **Write actions**: Return `{ emitter, promise }` via `to-promise-event`, even for single transactions. Wrap third-party write actions that return a bare hash instead of re-exporting them.
- **README sync**: The package README documents every `/actions` export and its params (including `encode*` helpers). Update it in the same change.

### API project

Return every address in the checksummed format. External sources — subgraphs, third-party APIs — may return addresses in lowercase, so convert them with `checksumAddress` from `viem` before they go into a response.

When changing the API in `api/src/` in a way that affects external behavior — adding, removing, or modifying an endpoint's URL, params, response shape (field names, types, and nullability), sample data, or error semantics — review and update `api/README.md` in the same change. Code is the source of truth; the README must reflect it.
