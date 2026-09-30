#!/bin/bash

### General UI

# Save screenshots to ~/Screenshots.
#
# NOT ~/Desktop and NOT ~/Downloads: both are TCC-protected ("Files and Folders"),
# so a terminal-based agent can only read them when the terminal app happens to
# hold a grant — which is per-app and gets dropped on app updates/resets. A plain
# directory under $HOME is not TCC-gated, so agents can always read it with no
# prompt and no Full Disk Access.
mkdir -p "${HOME}/Screenshots"
defaults write com.apple.screencapture location -string "${HOME}/Screenshots"

# Bottom left hot corner starts screen saver
defaults write com.apple.dock wvous-bl-corner -int 5
defaults write com.apple.dock wvous-bl-modifier -int 0

# Require password immediately after sleep or screen saver begins
defaults write com.apple.screensaver askForPassword -int 1
defaults write com.apple.screensaver askForPasswordDelay -int 0

### Finder

# Use column view in all Finder windows by default
# Four-letter codes for the other view modes: `icnv`, `Nlsv`, `Flwv`
defaults write com.apple.finder FXPreferredViewStyle -string "clmv"

### Dock

# Automatically hide and show the Dock
defaults write com.apple.dock autohide -bool true

# Don't show recent apps
defaults write com.apple.dock "show-recents" -bool false

# Set the icon size of Dock items
defaults write com.apple.dock largesize -int 48
defaults write com.apple.dock tilesize -int 48

# Remove the auto-hiding Dock delay
defaults write com.apple.dock autohide-delay -float 0

# Remove the animation when hiding/showing the Dock
defaults write com.apple.dock autohide-time-modifier -float 0

### iTerm2

# Specify the preferences directory
defaults write com.googlecode.iterm2.plist PrefsCustomFolder -string "~/dotfiles/machine/mac"

# Tell iTerm2 to use the custom preferences in the directory
defaults write com.googlecode.iterm2.plist LoadPrefsFromCustomFolder -bool true

# invert mouse scroll
defaults write NSGlobalDomain com.apple.swipescrolldirection -bool true

defaults write -g ApplePressAndHoldEnabled -bool false
