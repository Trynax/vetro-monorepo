#!/usr/bin/env bash
set -euo pipefail

gh pr create \
  --base prod \
  --head master \
  --title "Deploy $(date +%F)" \
  --body-file -
