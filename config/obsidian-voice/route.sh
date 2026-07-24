#!/usr/bin/env bash
# Pipeline: audio file → local whisper.cpp → claude -p → vault edit
# Called from Hammerspoon. Single-line summary to stdout on success.
set -euo pipefail

# Hammerspoon launches us with a minimal PATH — make sure tools are findable.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

AUDIO="${1:-/tmp/obsidian-voice-capture.wav}"

VAULT_DIR="${OBSIDIAN_VAULT:-$HOME/src/Obsidian Vault}"
WHISPER_BIN="${WHISPER_BIN:-/opt/homebrew/bin/whisper-cli}"
WHISPER_MODEL="${WHISPER_MODEL:-$HOME/.config/whisper/ggml-base.en.bin}"
ROUTE_PROMPT="${ROUTE_PROMPT:-$HOME/.config/obsidian-voice/route-prompt.md}"
CLAUDE_MODEL="${OBSIDIAN_VOICE_CLAUDE_MODEL:-claude-haiku-4-5}"

INBOX_DIR="$VAULT_DIR/.inbox"
mkdir -p "$INBOX_DIR"

# --- sanity ---
[[ -f "$AUDIO" ]]         || { echo "no audio at $AUDIO" >&2; exit 1; }
[[ -x "$WHISPER_BIN" ]]   || { echo "whisper-cli missing: $WHISPER_BIN" >&2; exit 1; }
[[ -f "$WHISPER_MODEL" ]] || { echo "whisper model missing: $WHISPER_MODEL" >&2; exit 1; }
[[ -f "$ROUTE_PROMPT" ]]  || { echo "route prompt missing: $ROUTE_PROMPT" >&2; exit 1; }
command -v claude >/dev/null || { echo "claude CLI not on PATH" >&2; exit 1; }

# --- transcribe ---
TS=$(date +%Y%m%d-%H%M%S)
PREFIX="$INBOX_DIR/$TS"
"$WHISPER_BIN" \
    -m "$WHISPER_MODEL" \
    -f "$AUDIO" \
    -nt -otxt -of "$PREFIX" \
    >/dev/null 2>&1

TRANSCRIPT_FILE="${PREFIX}.txt"
[[ -f "$TRANSCRIPT_FILE" ]] || { echo "whisper produced no output" >&2; exit 1; }

TEXT=$(tr '\n' ' ' < "$TRANSCRIPT_FILE" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')

if [[ -z "$TEXT" || "$TEXT" == "[BLANK_AUDIO]" || "$TEXT" =~ ^\[.*\]$ ]]; then
    rm -f "$TRANSCRIPT_FILE"
    echo "no speech detected"
    exit 0
fi

# --- route via claude ---
cd "$VAULT_DIR"

# Single-shot; print final text only; system prompt appended (vault context lives in CLAUDE.md if present)
RESULT=$(claude \
    --model "$CLAUDE_MODEL" \
    --append-system-prompt "$(cat "$ROUTE_PROMPT")" \
    -p "Voice transcript (just spoken aloud, may have minor transcription errors): \"$TEXT\"" \
    2>/dev/null)

# Emit just the summary line. Model is instructed to start it with "→".
SUMMARY=$(echo "$RESULT" | grep -m1 '^→' || echo "$RESULT" | head -1)
echo "${SUMMARY:-captured}"

# Keep transcript for debugging (in vault .inbox/, gitignore if you version it)
