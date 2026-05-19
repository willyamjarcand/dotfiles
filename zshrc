# load custom executable functions
#for function in ~/.zsh/functions/*; do
#  source $function
#done

# extra files in ~/.zsh/configs/pre , ~/.zsh/configs , and ~/.zsh/configs/post
# these are loaded first, second, and third, respectively.
_load_settings() {
  _dir="$1"
  if [ -d "$_dir" ]; then
    if [ -d "$_dir/pre" ]; then
      for config in "$_dir"/pre/**/*; do
        . $config
      done
    fi

    for config in "$_dir"/**/*; do
      case "$config" in
        "$_dir"/(pre|post)/*)
          :
          ;;
        *)
          . $config
          ;;
      esac
    done

    if [ -d "$_dir/post" ]; then
      for config in "$_dir"/post/**/*; do
        . $config
      done
    fi
  fi
}
_load_settings "$HOME/.zsh/configs"

# Local config
[[ -f ~/.zshrc.local ]] && source ~/.zshrc.local

# aliases
[[ -f ~/.aliases ]] && source ~/.aliases

export PATH="$HOME/.bin:$PATH"
export PATH="$HOME/bin:$PATH"

[[ -x /opt/homebrew/bin/brew ]] && eval $(/opt/homebrew/bin/brew shellenv)

c(){
  clear
}


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

# fuzzyfind default options
export FZF_DEFAULT_OPTS="
  --bind 'ctrl-j:preview-down'
  --bind 'ctrl-k:preview-up'
"

# bun completions
[ -s "/home/wilyuhm/.bun/_bun" ] && source "/home/wilyuhm/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
# export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
# export JAVA_HOME=$(brew --prefix openjdk)

[ -f /opt/dev/dev.sh ] && source /opt/dev/dev.sh

# Wealthsimple-specific configuration
if [[ -d ~/.config/wealthsimple ]]; then
  source ~/.config/wealthsimple/env.secrets
  [[ -f ~/.zsh/configs/wealthsimple.zsh ]] && source ~/.zsh/configs/wealthsimple.zsh

  export AWS_REGION='us-east-1'
  export FORT_KNOX_GRPC_VERSION="1.72.0"

  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/tools:$ANDROID_HOME/tools/bin:$ANDROID_HOME/platform-tools"
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
  export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"

  export ZSH="$HOME/.oh-my-zsh"
  plugins=(git)
  [[ -f $ZSH/oh-my-zsh.sh ]] && source $ZSH/oh-my-zsh.sh
fi

eval "$(~/.local/bin/mise activate zsh)"

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) export PATH="$PNPM_HOME/bin:$PATH" ;;
esac
# pnpm end
