#!/usr/bin/env bash
# Rename the tmux window to a short, readable label for the Claude session.
#
# Priority:
#   1. Jira ticket parsed from the current git branch (e.g. feat/DBE-1127-x -> DBE-1127)
#   2. Repo name (basename of the git toplevel)
#   3. Claude's task topic (its OSC pane title) -- least readable, so last resort
#      and only used when the pane isn't inside a git repo.
#
# Invoked from Claude Code hooks (Stop / UserPromptSubmit), which inherit $TMUX
# and $TMUX_PANE from the pane Claude runs in.

set -euo pipefail

[ -n "${TMUX:-}" ] || exit 0
[ -n "${TMUX_PANE:-}" ] || exit 0

pane_path=$(tmux display-message -p -t "$TMUX_PANE" '#{pane_current_path}' 2>/dev/null || true)

name=""

# 1. Jira ticket from the current git branch.
if [ -n "$pane_path" ]; then
  branch=$(git -C "$pane_path" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  ticket=$(printf '%s' "$branch" | grep -oiE '[A-Z]{2,}-[0-9]+' | head -n1 || true)
  [ -n "$ticket" ] && name=$(printf '%s' "$ticket" | tr '[:lower:]' '[:upper:]')
fi

# 2. Repo name.
if [ -z "$name" ] && [ -n "$pane_path" ]; then
  root=$(git -C "$pane_path" rev-parse --show-toplevel 2>/dev/null || true)
  [ -n "$root" ] && name=$(basename "$root")
fi

# 3. Claude's task topic (full, just glyph-stripped).
if [ -z "$name" ]; then
  title=$(tmux display-message -p -t "$TMUX_PANE" '#{pane_title}' 2>/dev/null || true)
  name=$(printf '%s' "$title" | sed -E 's/^[^[:alnum:]]+[[:space:]]*//')
fi

if [ -n "$name" ]; then
  tmux rename-window -t "$TMUX_PANE" "$name"
fi
exit 0
