# Give each new Ghostty tab a distinct background color. macOS tints the tab
# in the tab bar with the surface background, so cycling OSC 11 per tab makes
# tabs visually distinguishable.

if [[ $TERM_PROGRAM == ghostty && -z $TMUX && $SHLVL -eq 1 && -o interactive ]]; then
  () {
    local -a colors=(
      '#3a1f24'  # maroon
      '#1e2a45'  # navy
      '#1f3325'  # forest
      '#2e2340'  # violet
      '#38321c'  # olive
      '#16333a'  # teal
      '#3d2333'  # plum
      '#3d2a1c'  # rust
    )

    local cache=${XDG_CACHE_HOME:-$HOME/.cache}
    local state=$cache/ghostty-tab-color
    [[ -d $cache ]] || mkdir -p $cache

    local prev=0
    [[ -r $state ]] && prev=$(<$state)
    local i=$(( (${prev:-0} + 1) % $#colors ))
    print -r -- $i >| $state

    printf '\033]11;%s\007' $colors[$((i + 1))]
  }
fi
