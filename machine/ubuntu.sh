#!/bin/bash
set -euo pipefail

IS_CONTAINER=false
[ -f /.dockerenv ] && IS_CONTAINER=true

# Install required packages
sudo apt-get update -q
sudo apt-get install -y curl git fzf rcm silversearcher-ag ack zsh \
  zoxide direnv bat ripgrep tmux git-delta lazygit

# bat ships as batcat on Ubuntu — provide a consistent alias
if command -v batcat &>/dev/null && ! command -v bat &>/dev/null; then
  mkdir -p "$HOME/.local/bin"
  ln -sf "$(command -v batcat)" "$HOME/.local/bin/bat"
fi

if [ "$IS_CONTAINER" = false ]; then
  sudo apt-get install -y fuse libfuse2 fonts-powerline neofetch
  pip3 install --user powerline-status
fi

# Starship
if ! command -v starship &>/dev/null; then
  mkdir -p "$HOME/.local/bin"
  curl -sS https://starship.rs/install.sh | sh -s -- --yes --bin-dir "$HOME/.local/bin"
fi

# Fonts (skip in container — no display server)
if [ "$IS_CONTAINER" = false ]; then
  FONT_DIR="$HOME/.fonts"
  mkdir -p "$FONT_DIR"
  sudo cp -a "$HOME/dotfiles/fonts/." "$FONT_DIR"
  fc-cache -f -v
fi

# Oh My Zsh
if [ ! -d "$HOME/.oh-my-zsh" ]; then
  git clone https://github.com/ohmyzsh/ohmyzsh.git "$HOME/.oh-my-zsh"
fi

# Plugins
[ ! -d "$HOME/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting" ] && \
  git clone https://github.com/zsh-users/zsh-syntax-highlighting "$HOME/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting"

[ ! -d "$HOME/.oh-my-zsh/custom/plugins/zsh-autosuggestions" ] && \
  git clone https://github.com/zsh-users/zsh-autosuggestions "$HOME/.oh-my-zsh/custom/plugins/zsh-autosuggestions"

# Themes
cp "$HOME/dotfiles/zsh/themes/pixegami-agnoster.zsh-theme" "$HOME/.oh-my-zsh/themes/"
[ ! -L "$HOME/.oh-my-zsh/themes/dracula.zsh-theme" ] && \
  ln -s "$HOME/dotfiles/zsh/themes/dracula/dracula.zsh-theme" "$HOME/.oh-my-zsh/themes/dracula.zsh-theme"

# GNOME terminal profile (desktop only)
if [ "$IS_CONTAINER" = false ] && command -v dconf &>/dev/null; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  dconf load /org/gnome/terminal/legacy/profiles:/:fb358fc9-49ea-4252-ad34-1d25c649e633/ <"$SCRIPT_DIR/ubuntu/terminal_profile.dconf"

  add_list_id=fb358fc9-49ea-4252-ad34-1d25c649e633
  old_list=$(dconf read /org/gnome/terminal/legacy/profiles:/list | tr -d "]")
  front_list=$( [ -z "$old_list" ] && echo "[" || echo "$old_list, " )
  dconf write /org/gnome/terminal/legacy/profiles:/list "${front_list}'${add_list_id}']"
  dconf write /org/gnome/terminal/legacy/profiles:/default "'${add_list_id}'"
fi

# Dotfiles symlinks via rcm
env RCRC="$HOME/dotfiles/rcrc" rcup -f
