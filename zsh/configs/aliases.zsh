bindkey '^K' kill-whole-line

# Neovim socket functions
start_nvim() {
    CURRENT_DIR=$(basename "$PWD")
    SOCKET="/tmp/nvim-${CURRENT_DIR}"
    nvim --listen "$SOCKET"
}
alias vi='start_nvim'

# Function to get API key from macOS Keychain
get_openai_api_key() {
    security find-generic-password -a "$USER" -s "openai_api_key" -w 2>/dev/null
}

ai() {
  local port=$(basename ~/.claude/ide/*.lock .lock 2>/dev/null)
  if [[ -n "$port" ]]; then
    CLAUDE_CODE_SSE_PORT="$port" ENABLE_IDE_INTEGRATION="true" FORCE_CODE_TERMINAL="true" claude "$@"
  else
    claude "$@"
  fi
}
