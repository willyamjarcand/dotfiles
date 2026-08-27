#!/bin/bash
# Keep Spotlight out of directories that are pure build churn. Indexing six
# worktrees' worth of node_modules costs GBs of mdworker memory and buys nothing
# -- code search goes through rg, not Spotlight.
set -euo pipefail

for dir in "$HOME/.worktrees" "$HOME/src"; do
  [ -d "$dir" ] || continue
  touch "$dir/.metadata_never_index"
  echo "spotlight: excluded $dir"
done
