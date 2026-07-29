bindkey '^K' kill-whole-line

alias c='clear'
alias herd='herdr'

tm() {
  if [ -n "$1" ]; then
    tmux new-session -A -s "$1"
  else
    session=$(tmux list-sessions -F "#{session_name}" | fzf)
    if [ -n "$session" ]; then
      tmux attach-session -t "$session"
    fi
  fi
}

wt() {
  local selected
  selected=$(git worktree list | awk 'NR==1{root=$1} {
    path = $1
    n = split(path, parts, "/")
    name = (path == root) ? "root" : parts[n]
    print name "\t" path
  }' | fzf --delimiter=$'\t' --with-nth=1 --preview 'git -C {2} log --oneline -10' | cut -f2)
  [ -n "$selected" ] && cd "$selected"
}

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

# jiratui: generate the config from env on first use, then launch the UI.
jira() {
  local cfg="${XDG_CONFIG_HOME:-$HOME/.config}/jiratui/config.yaml"
  [[ -f "$cfg" ]] || jiratui-config || return 1
  jiratui ui "$@"
}

# gh-dash: GitHub PR/issue dashboard
alias ghd='gh dash'
