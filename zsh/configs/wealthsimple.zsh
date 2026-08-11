# Sourced by zshrc when ~/.config/wealthsimple exists.
# Most WS exports live in zshrc under the guard; this file is reserved for
# anything that warrants its own config file later.

# dev: fuzzy-find a repo under ~/src/github.com/wealthsimple and cd into it.
dev() {
  local root="$HOME/src/github.com/wealthsimple"
  local selected
  selected=$(
    find "$root" -mindepth 1 -maxdepth 1 -type d 2>/dev/null |
      sort |
      fzf --delimiter=/ --with-nth=-1 \
          --preview 'git -C {} log --oneline -10 2>/dev/null || ls -la {}'
  )
  [ -n "$selected" ] && cd "$selected"
}
