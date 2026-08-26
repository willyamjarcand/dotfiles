#!/bin/bash
# Install the memwatch LaunchAgent: samples memory every 60s into
# ~/.local/state/memwatch. Idempotent -- re-running reloads the agent.
set -euo pipefail

label="com.willyam.memwatch"
src="$HOME/dotfiles/machine/mac/$label.plist"
dst="$HOME/Library/LaunchAgents/$label.plist"

mkdir -p "$HOME/.local/state/memwatch" "$HOME/Library/LaunchAgents"
sed "s|__HOME__|$HOME|g" "$src" >"$dst"

launchctl bootout "gui/$UID/$label" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$dst"
launchctl kickstart "gui/$UID/$label"

echo "memwatch: sampling every 60s -> ~/.local/state/memwatch (\`memwatch report\` to read)"
