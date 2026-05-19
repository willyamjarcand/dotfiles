# pi.dev configs

Tracked pi.dev configs for [pi](https://pi.dev) — the coding agent.

## What lives here

- `prompts/` — Markdown prompt templates. Each `name.md` is invoked as `/name` in pi.
- `skills/` — [Agent Skills](https://agentskills.io/specification) loaded on-demand by the model.
- `extensions/` — TypeScript extensions auto-loaded by pi. See pi's [extensions docs](https://github.com/badlogic/pi-coding-agent/blob/main/docs/extensions.md).
- `bin/` — helper shell scripts invoked by extensions (kept on `$PATH` of spawned subprocesses).

## What does NOT live here

`~/.pi/agent/` also contains machine-specific state that is **intentionally not tracked**:

- `auth.json` — OAuth credentials / API keys
- `sessions/` — chat history
- `mcplocker-tools.json`, `litellm-models.json` — generated caches
- `settings.json` — has a `_ws_pi` managed block on Wealthsimple machines and is mutated by pi itself

`pi` is added to `EXCLUDES` in `~/dotfiles/rcrc` so `rcup` does NOT symlink `~/dotfiles/pi/` over `~/.pi/`.

## How pi finds these files

`~/.pi/agent/settings.json` references this directory by absolute path:

```json
{
  "prompts": ["~/dotfiles/pi/prompts"],
  "extensions": ["~/dotfiles/pi/extensions"],
  "skills": [
    "~/dotfiles/pi/skills",
    "~/.claude/skills"
  ],
  "packages": [
    "../../src/github.com/willyamjarcand/pi-catacombs"
  ]
}
```

The `packages` entry above pulls in [pi-catacombs](https://github.com/willyamjarcand/pi-catacombs), the standalone roguelike repo. Game code lives outside this dotfiles repo because it's a substantial side project that grows independently.

`~/.claude/skills` keeps your existing Claude Code skills working in pi with zero porting. For team skills that live inside a repo's `.claude/skills/`, drop a project-local `.pi/settings.json` with `{"skills": ["../.claude/skills"]}` so they load only when pi runs inside that repo.

`~` and absolute paths are supported everywhere.

## Adding a new prompt template

Drop a Markdown file into `prompts/`. Optional frontmatter:

```markdown
---
description: One-line description shown in /-autocomplete
argument-hint: "<required-arg> [optional-arg]"
---
Prompt body. $1, $2, $@, ${@:N}, ${@:N:L} substitute arguments.
```

## Adding a new extension

Drop a `name.ts` file into `extensions/` — pi loads it via [jiti](https://github.com/unjs/jiti), so TypeScript works without a build step. See `extensions/effort.ts` for a minimal example.

## Reload after editing

Run `/reload` inside pi to pick up changes without restarting.

## Slash commands provided here

| Command | Source | What |
|---|---|---|
| `/plan <task>` | `prompts/plan.md` | Write a plan.md with clarifying questions until 95% confident |
| `/diagram <question>` | `prompts/diagram.md` | Generate Mermaid diagrams answering a codebase question |
| `/loop <task>` | `prompts/loop.md` | Iterate until acceptance criteria are met (TDD-style) |
| `/effort <level>` | `extensions/effort.ts` | Set thinking level (off\|minimal\|low\|medium\|high\|xhigh) |
| `/watch-pr [#] [flags]` | `extensions/watch-pr.ts` | Spawn a tmux side-quest agent that watches a PR until merge-ready |
| `/doom`, `/doom-overlay` | `extensions/doom-overlay/` | Play DOOM in a TUI overlay (copied from pi's bundled example) |
| `/skill:watch-pr` | `skills/watch-pr/` | The watcher loop body itself (invoked by the wrapper script, not by you) |
| `/dungeon`, `/dungeon-pixel`, ... | (external) [pi-catacombs](https://github.com/willyamjarcand/pi-catacombs) | Pixel-art roguelike. Lives in its own repo. |

### `/watch-pr` quick reference

```
/watch-pr                                  # auto-detect PR for current branch, defaults: --effort xhigh --poll 300
/watch-pr 1234
/watch-pr 1234 --effort high --poll 120
/watch-pr 1234 --model bedrock-claude-opus-4-7
/watch-pr 1234 --intent fixing flaky payment tests after the rate-limiter change
/watch-pr stop 1234                        # signal the running watcher to wind down
```

The watcher runs in a fresh tmux window so your main session keeps full context. It receives a one-time context briefing (last 3 user messages from the main session, branch name, ticket key, recent commits, PR title) so it can judge whether each review comment is actually relevant to the change. It commits fixes for relevant comments and writes a `PR-NOTES-<pr>.md` with explanations for the rest. It NEVER replies on GitHub.
