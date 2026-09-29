#!/usr/bin/env bash
set -euo pipefail

git fetch --quiet origin master prod

numbers=$(git log origin/prod..origin/master --merges --pretty=format:"%s" |
  sed -nE 's/^Merge pull request #([0-9]+) from .*/\1/p')

if [ -z "$numbers" ]; then
  echo "master and prod are in sync. Nothing to release." >&2
  exit 1
fi

fields=""
index=0
for number in $numbers; do
  index=$((index + 1))
  fields+=$(printf 'pr%03d: pullRequest(number: %s) { body closingIssuesReferences(first: 20) { nodes { number title } } headRefName number title } ' "$index" "$number")
done

gh api graphql \
  -F owner='{owner}' \
  -F repo='{repo}' \
  -f query="query(\$owner: String!, \$repo: String!) { repository(owner: \$owner, name: \$repo) { $fields } }" \
  -q '
    def tag($label; $items): if ($items | length) > 0 then "\($label): " + ($items | join(", ")) else empty end;
    .data.repository[]
    | (.number | tostring) as $self
    | [.closingIssuesReferences.nodes[] | {number: (.number | tostring), title}] as $closes
    | ([.body | gsub("(?s)<!--.*?-->"; "") | scan("(?:#|/(?:issues|pull)/)([0-9]+)")[0]]
      | unique - [$closes[].number] - [$self]) as $refs
    | [
        "#\($self)",
        .title,
        "branch: \(.headRefName)",
        tag("closes"; [$closes[] | "#\(.number) (\(.title))"]),
        tag("refs"; $refs | map("#" + .))
      ]
    | join(" | ")
  '
