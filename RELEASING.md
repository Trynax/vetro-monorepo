# Releasing packages

This monorepo publishes five packages to npm under `@vetro-protocol/*`:

- `@vetro-protocol/bridge`
- `@vetro-protocol/cli`
- `@vetro-protocol/earn`
- `@vetro-protocol/gateway`
- `@vetro-protocol/treasury`

A package is publishable only if its `package.json` literally contains `"private": false`. Apps (`web`, `api`, `subgraph`) stay private and never publish.

## Versioning

Bump a package's `version` only when you want to publish a new one. Changes that don't need to ship to npm — including refactors, tests, and edits consumed only by `web` / `api` — can land on `master` without touching `version`. `web` and `api` resolve via `workspace:*`, so they always pick up the latest source regardless of the package's declared version.

When you do want to publish, bump the version in the PR that contains the change you want to ship (or in a follow-up PR before running the release script).

## Cutting a release

From `master`, after the package's `version` has been bumped in `package.json`, run the release script (`scripts/release.sh`) for that package. It:

- Pulls the latest tags from origin so its checks aren't affected by local repo state.
- Refuses to continue if a release for this package version already exists on the remote — prompting you to bump the version.
- Composes release notes from the PRs that touched the package's directory since the previous release of the same package. The first GitHub release of a package falls back to a short "Initial release" placeholder instead of dumping the full history.
- After your confirmation, creates the tag, pushes it, and opens a **draft** GitHub Release.

Nothing has hit npm yet. Review the draft on GitHub and edit the notes if you want. When ready, click **"Publish release"** — that's the only thing that fires the npm publish.

## What happens after you publish the draft

`.github/workflows/publish.yml` fires on `release: published`. It:

1. Allowlists tag prefixes `bridge@`, `cli@`, `earn@`, `gateway@`, `treasury@` at the job level — non-package releases (e.g. `web@<date>`, `vetro-app-subgraph@<version>`) are ignored here.
2. Extracts the package name from the tag (`bridge@1.0.1` → `bridge`).
3. Runs `./scripts/publish-package.sh <pkg> <version>` (both derived from the tag), which fails fast if `<version>` doesn't match `packages/<pkg>/package.json`, then runs `pnpm publish` (with `prepublishOnly` chaining the clean + emit step).

The publish script is **idempotent**: if `<name>@<version>` is already on npm, it logs a skip and exits 0. Re-running a workflow on the same release is a no-op.

### Dist-tags

- A version containing `-` publishes under a dist-tag derived from the prerelease identifier:
  - `1.0.0-beta` → `--tag beta`
  - `1.0.0-rc.1` → `--tag rc`
- Stable versions (no `-`) publish under the default `latest` tag.

So `pnpm add @vetro-protocol/<pkg>` always pulls the latest stable. Beta users opt in with `@vetro-protocol/<pkg>@beta`.

### Authentication & provenance

The workflow does not use an `NPM_TOKEN`. It authenticates to npm via **trusted publishing**: each package on npmjs.com has a trusted-publisher entry pointing at this repo and `.github/workflows/publish.yml`, and `pnpm publish` exchanges the GitHub Actions OIDC token for a short-lived registry token at publish time. That same `id-token: write` permission also signs the npm provenance attestation when `publishConfig.provenance` is `true` in a package's `package.json`.

## Adding a new publishable package

1. On npmjs.com, configure a trusted publisher for the new package: org = `vetro-protocol` (GitHub), repo = this repo, workflow = `publish.yml`. Without this the CI publish will fail authentication.
2. Set `"private": false` in its `package.json` and add `publishConfig` (mirror an existing publishable package).
3. Add its name to the `if:` allowlist in `.github/workflows/publish.yml`.
4. First publish: either run `./scripts/release.sh <pkg>` on `master`, or do a one-time manual `pnpm -F @vetro-protocol/<pkg> publish` to claim the name on npm.
