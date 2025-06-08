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

# Claude Code
export AWS_REGION='us-east-1'
export ANTHROPIC_MODEL='us.anthropic.claude-sonnet-4-20250514-v1:0'
export ANTHROPIC_SMALL_FAS2T_MODEL='us.anthropic.claude-3-5-haiku-20241022-v1:0'
export CLAUDE_CODE_USE_BEDROCK=1

source /Users/willyam.arcand/.config/wealthsimple/rbenv/config.zsh
source /Users/willyam.arcand/.config/wealthsimple/direnv/config.zsh
source /Users/willyam.arcand/.config/wealthsimple/nvm/config.zsh
eval "$(mise activate zsh)"
eval "$(ws hook zsh)"
