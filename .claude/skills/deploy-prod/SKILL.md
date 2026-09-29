---
name: deploy-prod
description: Open the release PR from `master` to `prod`, with a description that groups the merged PRs into the real changes they deliver. Use when the user invokes `/deploy-prod` or asks to deploy, release, or open the master → prod PR.
---

# deploy-prod

Run the scripts in this order, from the repo root. Do not run other commands, except `gh issue view` in step 2.

## 1. List the PRs to release

```bash
.claude/skills/deploy-prod/scripts/list-prs.sh
```

It prints one line per PR in `master` that is not in `prod`, newest first:

```markdown
#845 | Add historic TVL chart to the analytics page | branch: tvl-historic-chart-pt3 | closes: #825 (Add TVL stacked bar chart with historic data)
#844 | Add swap redeem command to the CLI | branch: cli-swap-redeem | refs: #445
```

`closes` lists the issues that the PR closes, with their titles. `refs` lists the other issues and PRs that its description mentions.

If it exits with an error, show the error to the user and stop.

## 2. Group the PRs into changes

The goal: a reader of the PR description knows which changes go to production. A change is one thing that a user or developer gets from the release. Group the PRs into changes on a best-effort basis. Some signs that PRs are one change:

- They close or refer to the same issue.
- One PR refers to another PR in the list.
- They work toward the same result, for example the branches `tvl-historic-chart-pt1`, `-pt2` and `-pt3`.

These signs are not rules. A PR can mention a new issue for follow-up work, or a PR that gave an idea, and these do not make it part of the same change. If you do not know what a `refs` issue is about, read its title with `gh issue view <number> --json title -q .title`.

Write each change as one short line in imperative mood, then the PRs that deliver it. Include every PR exactly once. Put each change in one of these sections, in this order, and omit empty sections:

- **Features**: new or changed behavior for users or for developers that use the packages, API, or CLI.
- **Bug fixes**: corrections of wrong behavior.
- **Chores**: all other changes, for example tests, refactors, tooling, and dependencies.

## 3. Create the PR

Pass the description on stdin:

```bash
.claude/skills/deploy-prod/scripts/create-pr.sh <<'EOF'
### Features

- Add a historic TVL chart to Analytics (#823, #835, #845)
- Add swap redeem commands to the CLI (#844, #848)

### Bug fixes

- Reconcile pending activity on reload (#805)

### Chores

- Add E2E test for borrowing more on a position (#841)
EOF
```

The script creates the PR titled `Deploy <YYYY-MM-DD>` and prints its URL. If a master → prod PR is already open, `gh` shows an error with the URL of that PR. Show the URL to the user.
