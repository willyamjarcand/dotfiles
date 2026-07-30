#!/usr/bin/env bash
# Rename the tmux window to Claude Code's current topic.
#
# Claude Code sets its terminal title (an OSC escape) to a short summary of the
# current task, e.g. "⠂ Open pull request from GitHub CLI". tmux stores that per
# *pane* as #{pane_title}. This hook reads THIS Claude pane's title and pins it
# as the window name via rename-window, so it wins even when the window has other
# panes (shells, etc.) stamping their own titles.
#
# Invoked from Claude Code hooks (Stop / UserPromptSubmit), which inherit $TMUX
# and $TMUX_PANE from the pane Claude runs in.

set -euo pipefail

[ -n "${TMUX:-}" ] || exit 0
[ -n "${TMUX_PANE:-}" ] || exit 0

title=$(tmux display-message -p -t "$TMUX_PANE" '#{pane_title}' 2>/dev/null || true)

# Strip Claude's leading status glyph + spaces (e.g. "⠂ ", "✳ ").
title=$(printf '%s' "$title" | sed -E 's/^[^[:alnum:]]+[[:space:]]*//')

# Keep the name short & readable in the tmux status bar: first MAX_WORDS words.
MAX_WORDS=2
title=$(printf '%s' "$title" | cut -d' ' -f1-"$MAX_WORDS")

[ -n "$title" ] && tmux rename-window -t "$TMUX_PANE" "$title"
exit 0
