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

# bun completions
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"

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

fi

_mise=$(command -v mise 2>/dev/null || echo "$HOME/.local/bin/mise")
[[ -x "$_mise" ]] && eval "$($_mise activate zsh)"
unset _mise
eval "$(zoxide init zsh)"

export XDG_CONFIG_HOME="$HOME/.config"

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) export PATH="$PNPM_HOME/bin:$PATH" ;;
esac
# pnpm end

eval "$(direnv hook zsh)"
