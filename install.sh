#!/bin/bash

cd "$(dirname "$0")"

os=$(uname -s)

if [ $SPIN ]; then
  ./machine/spin.sh
elif [ "$os" = "Darwin" ]; then
  # Check macOS version
  version=$(sw_vers -productVersion)
  ./machine/mac.sh
elif [ "$os" = "Linux" ]; then

  ./machine/ubuntu.sh
else
  echo "Unsupported operating system"
fi

if [ $SPIN ]; then
  cp -f gitconfig-spin gitconfig-default
elif hostname | grep -i Shopify &>/dev/null; then
  cp -f gitconfig-shopify gitconfig-default
elif hostname | grep -i Wealthsimple &>/dev/null; then
  cp -f gitconfig-wealthsimple gitconfig-default
else
  cp -f gitconfig-personal gitconfig-default
fi

# Neofetch config
if [ -f "$HOME/dotfiles/zsh/configs/neofetch/neofetch.conf" ]; then
  mkdir -p "$HOME/.config/neofetch"
  cp "$HOME/dotfiles/zsh/configs/neofetch/neofetch.conf" "$HOME/.config/neofetch/config.conf"
fi

env RCRC=$HOME/dotfiles/rcrc rcup -f
