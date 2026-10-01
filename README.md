# dotfiles
Behold the magnum opus of my coding journey, the celestial ark carrying my most treasured configurations - the legendary dotfiles. Their radiant presence here, on this GitHub repository, is nothing short of the digital Elysium. They're the seamless symphony of code snippets, masterfully woven to orchestrate the perfect symphony of functionality. Each line is meticulously curated and crafted, shimmering like an individual thread in a richly woven tapestry of software prowess. They are not merely configurations, they are the essence of programming poetry, a testament to countless battles waged on the frontlines of technological challenges. Venture into this GitHub repository and prepare to witness the ballet of finely-tuned utilities, settings, scripts, and the raw power of my technical virtuosity.

## Usage
This is willyam's personal dotfiles. Should work in 
1. Macos
2. Spin
3. Ubuntu

## Installation

1. `cd ~`
2. `git clone https://github.com/willyamacaroni/dotfiles.git`
3. `cd dotfiles`
4. `source install.sh`

## jiratui

[jiratui](https://github.com/whyisdifficult/jiratui) is a terminal UI for Jira.
Installed by the machine setup (`brew "jiratui"` on macOS, `uv tool install jiratui`
on Ubuntu).

jiratui reads its API token as a literal value in `~/.config/jiratui/config.yaml`
(no env-var interpolation), so the config is **generated from the environment** rather
than committed — the token never lives in this repo. `bin/jiratui-config` renders it,
picking base URL / username defaults from the machine:

- **Work laptop** (detected by `~/.config/wealthsimple/` existing): defaults to the
  Wealthsimple Jira instance. Put the token in the already-sourced secrets file:
  ```sh
  # ~/.config/wealthsimple/env.secrets   (not tracked by git)
  export JIRA_API_TOKEN="<your-jira-api-token>"
  ```
- **Personal laptop**: set everything in `~/.zshrc.local`:
  ```sh
  export JIRA_API_TOKEN="<token>"
  export JIRA_API_BASE_URL="https://<you>.atlassian.net"
  export JIRA_API_USERNAME="you@example.com"
  ```

Create the token at https://id.atlassian.com/manage-profile/security/api-tokens.

Then, in a fresh shell, run `jira` — it generates the config on first use and opens the
UI. Re-run `jiratui-config` any time to regenerate after changing the token.

Pre-made filters (`pre_defined_jql_expressions` in `bin/jiratui-config`, tuned to DBE +
on-call EOC) aren't a visible dropdown: in the UI press `j` to focus the JQL box, then
`Ctrl+E` to open the JQL Editor — the "Pre-defined expressions" dropdown lists them.
Filter #1 auto-loads on launch.

## gh-dash

[gh-dash](https://gh-dash.dev) is a GitHub PR/issue dashboard, installed as a `gh` CLI
extension (`gh extension install dlvhdr/gh-dash`, done by the machine setup). Launch with
`gh dash` or the `ghd` alias. Auth uses your existing `gh` login — no secrets — so the
config is committed at `config/gh-dash/config.yml` (PR sections: mine / needs-my-review /
involved / recently-merged; issue sections: mine / assigned).

## crit

[crit](https://crit.md) opens agent/PR changes in a browser for line-by-line review.
Installed via Homebrew (macOS) or `go install` (Ubuntu). No config or account needed —
run `crit` in a repo, comment on lines in the browser, and the agent reads them via
`crit comments --json`.

The machine setup also installs crit's Claude Code integration as a user-scoped plugin
(`claude plugin marketplace add tomasz-tomczyk/crit` + `claude plugin install crit@crit`),
which adds the `/crit` review-loop skill. Note `crit install <agent>` is *project*-scoped
(writes `./.claude/skills/`); the plugin above is global, which is why it lives in the
setup scripts rather than the repo.

## Screenshots

Screenshots save to `~/Screenshots`, set in `machine/mac/defaults.sh`.

They deliberately do **not** go to `~/Desktop` or `~/Downloads`. macOS guards
Desktop, Documents, Downloads, iCloud Drive, and external volumes behind
privacy (TCC) prompts, and grants are per-app — so a coding agent can only read
them while the terminal app happens to hold one, which silently disappears on
app updates. A plain directory under `$HOME` is not guarded at all, so an agent
reads it with no prompt and without Full Disk Access.

After changing the location, restart the UI so it takes effect:

```sh
killall SystemUIServer
```

Note: macOS writes a U+202F narrow no-break space before AM/PM in screenshot
filenames, so typing one of those names by hand won't match. Use shell
tab-completion or a wildcard instead:

```sh
read ~/Screenshots/Screenshot*4.16.13*.png
```

## Excalidraw MCP in Wally/pi

Pi has no built-in MCP support, so Wally reaches the Excalidraw+ MCP server through
[`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter). The server config is
committed at `config/mcp/mcp.json` (linked to `~/.config/mcp/mcp.json` by `rcup`).

The API key is never in the repo or the environment: the config runs
`security find-generic-password … -w` when the server connects. Store the key once:

```sh
security add-generic-password -a "$USER" -s excalidraw_plus_api_key -w
```

The adapter itself is a Pi package, recorded in the untracked `~/.pi/agent/settings.json`,
so a new machine needs:

```sh
wally install npm:pi-mcp-adapter@2.37.0
```

`allowInstall: false` stops the agent adding new MCP servers by URL. `approveTools`
asks before tools that delete, remove users, change workspace settings, or create
invites; everything else (listing, reading, creating and editing scenes) runs freely.
Claude Code uses the same key via `bin/excalidraw-mcp-headers`.
