# Ubuntu compatibility plan

Goal: make these dotfiles boot a working zsh shell + dev tools on Ubuntu
(specifically Wealthsimple's devcontainer, but should generalize to any Ubuntu
24.04). macOS behavior must stay identical.

## Constraint

**Do not change behavior on macOS.** That means:
- `machine/mac.sh`, `machine/mac/*` — untouched.
- Shared files (`zshrc`, `tmux.conf`, `gitconfig`, `config/*`) — may be edited,
  but every change has to be a no-op on macOS (guarded by `command -v`, OS
  detection, or behave identically because the tool exists in both worlds).

## What breaks on Ubuntu today

Booting a fresh devcontainer with these dotfiles installed produces:

| Symptom | Cause | File |
|---|---|---|
| `zsh: command not found: zoxide` | `eval "$(zoxide init zsh)"` runs unconditionally | `zshrc:~95` |
| `direnv: command not found` | `eval "$(direnv hook zsh)"` runs unconditionally | `zshrc:~108` |
| `PATH` polluted with macOS-only paths | `~/Library/pnpm`, `~/Library/Android/sdk`, `/opt/homebrew/...` appended on every shell | `zshrc:~58–76` |
| Missing CLI tools | `bat`, `rg`, `tmux`, `nvim`, `lazygit`, `delta`, `zoxide`, `direnv` are in `machine/mac.sh` brew bundle but NOT in `machine/ubuntu.sh` apt list | `machine/ubuntu.sh` |
| `cp gitconfig-personal …` runs from wrong cwd | `install.sh` doesn't `cd` before running (also bit us in devcontainer) | `install.sh` |
| Fonts step copies into `~/Library/Fonts` | macOS-only path; ubuntu.sh already handles `~/.fonts`, but only in non-container mode — OK as-is | `machine/ubuntu.sh` |

Everything else (oh-my-zsh, rcm, fzf, ag, starship) already works on Ubuntu
because `machine/ubuntu.sh` installs them.

## Strategy

Three layers, in order of preference:

1. **Guard tool initializers in shared files.** Wrap every `eval "$(X init)"`
   with `command -v X &>/dev/null &&`. No-op on macOS (tool present), graceful
   on Ubuntu (missing tools just skip).
2. **OS-gate macOS-only `PATH` and env exports.** Wrap `/opt/homebrew`,
   `~/Library/...` exports in `[[ "$OSTYPE" == darwin* ]]` blocks. No-op on
   macOS (condition true), skipped on Ubuntu.
3. **Bring `machine/ubuntu.sh` up to parity with `machine/mac.sh`.** Add the
   missing tools to the apt install list, install Ubuntu equivalents where the
   package name differs (`silversearcher-ag` instead of `the_silver_searcher`,
   `bat` ships as `batcat` on Ubuntu, etc.).

## File-by-file changes

### `zshrc` — guard initializers and OS-gate macOS paths

Replace these lines (currently unconditional):

```zsh
[[ -x /opt/homebrew/bin/brew ]] && eval $(/opt/homebrew/bin/brew shellenv)
eval "$(zoxide init zsh)"
eval "$(direnv hook zsh)"
```

with:

```zsh
command -v zoxide &>/dev/null && eval "$(zoxide init zsh)"
command -v direnv &>/dev/null && eval "$(direnv hook zsh)"
```

(The brew line is already guarded — it's fine as is.)

Wrap macOS-only `PATH` blocks:

```zsh
if [[ "$OSTYPE" == darwin* ]]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/tools:..."
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
  export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
  export PNPM_HOME="$HOME/Library/pnpm"
fi
```

Linux equivalent (mise handles node toolchain, so we don't need a manual
`PNPM_HOME` — pnpm is on `PATH` via mise). No Linux block needed unless we
find a missing export.

### `machine/ubuntu.sh` — add parity packages

Current apt list:
```
curl git fzf rcm silversearcher-ag ack zsh
```

Add (all available in Ubuntu 24.04 main/universe):
```
zoxide direnv bat ripgrep tmux git-delta lazygit
```

Notes:
- `bat` ships as `batcat` on Ubuntu. Add a `bat → batcat` symlink in
  `$HOME/.local/bin/` for cross-platform aliases.
- `lazygit` is in `universe` since 24.04; older Ubuntus need a PPA — out of
  scope, devcontainer uses 24.04.
- Neovim: keep using `machine/ubuntu/install_neovim.sh` (existing script).

### `install.sh` — fix cwd bug

Already fixed at the devcontainer caller (`.devcontainer/post-create.sh` cds
into `~/dotfiles` before running). The script itself still has a latent bug:
`./machine/ubuntu.sh` is a relative path. Add at top:

```bash
cd "$(dirname "$0")"
```

No-op when invoked from the dotfiles dir (current macOS usage), fixes anything
that invokes via absolute path.

## Out of scope

- Nvim / lazygit / starship configs — already cross-platform (they live under
  `config/` and rcup symlinks them; the tools just need to exist on PATH).
- Tmux config — already cross-platform.
- Fonts on Ubuntu — `ubuntu.sh` handles non-container case; containers don't
  render fonts so we skip.
- Replacing rcm with stow/chezmoi — works fine on both OSes today.
- GUI apps (rectangle, bartender, meetingbar, ghostty) — macOS-only, stay in
  brew bundle.

## Verification

After changes:
1. **macOS**: `source install.sh && exec zsh` — no behavior change, all
   guarded blocks still fire because the tools are installed.
2. **Ubuntu devcontainer**: `ws dev create --branch ubuntu-compat-test` —
   shell boots cleanly, `zoxide`/`direnv`/`bat`/`rg`/`lazygit` all work, no
   "command not found" on startup.

## Order to ship

1. `zshrc` guards (smallest, biggest user-visible win — kills startup noise).
2. `machine/ubuntu.sh` parity packages.
3. `install.sh` cwd fix.

Each can be its own commit; no dependencies between them.
