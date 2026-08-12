---
name: orchestrate
description: Use to run several development tasks in parallel, each in its own crew worktree, tmux session, and Ghostty tab with its own Claude. Invoked as `orchestrate DBE-312 DBE-569 ...` or with free-form task descriptions. Plans every workspace first, gets one inline approval, then launches the whole fleet at once. For a single task, use start-task instead.
---

# Orchestrate

Turns a list of tasks into a fleet of parallel workspaces. Each one gets an isolated
git worktree, a 3-pane tmux session, a Ghostty tab, and its own Claude started at a
chosen effort level with its task already in hand.

Plan everything first, get **one** approval, then launch. Nothing is created before
the user approves.

## When not to use this

- **One task** → use `start-task`. A fleet of one is pure overhead.
- **Tasks that touch the same files** → parallel worktrees will conflict on merge.
  Say so and propose sequencing them instead.
- **More than 4 tasks** → each workspace runs an editor plus a Claude. Warn the user,
  propose the top 4, and offer to queue the rest for a second wave.

## Step 1: Resolve the work items

The invocation is either Jira keys (`orchestrate DBE-312 DBE-569`), free-form
descriptions, or a mix.

For each Jira key: call `mcp__atlassian__getAccessibleAtlassianResources` once for the
cloudId, then `mcp__atlassian__getJiraIssue` per key. Pull title, description,
acceptance criteria, and the repo the work belongs in.

For free-form items, the user's text is the mission; ask which repo if it isn't obvious.

Derive a workspace name per item — this becomes the branch (`crew/<name>`), the tmux
session, and the tab label:

- Jira: `<KEY>-<3-5 hyphenated words from the title>` → `DBE-312-eventsimple-cheque-filtering`
- Free-form: just the hyphenated words → `flaky-auth-specs`

The `tmux-rename-window.sh` hook parses the Jira key back out of the branch, so the
tmux window ends up labelled `DBE-312`. Keep the key first.

## Step 2: Scope each item in parallel

Dispatch one `Explore` agent per item, concurrently, in a single message. Each returns:

- which repo, and whether the work is confined to it
- the files and modules that need to change
- existing patterns to copy, and the test command for that area
- anything that makes the task bigger than the ticket suggests

Do not write code in this step.

## Step 3: Choose effort and model per item

Effort is per workspace, not global — it is the main lever on cost and quality here.

| Effort | Use for |
|--------|---------|
| `low` | Mechanical, single-file: config bumps, renames, copy changes |
| `medium` | A known pattern repeated: another endpoint, another migration, tests for existing code |
| `high` | **Default.** Multi-file features, anything needing design judgment |
| `xhigh` | Money, auth, concurrency, or event-sourcing correctness; ambiguous requirements |
| `max` | Cross-repo migrations, or a task an earlier wave already failed at |

Model: omit it (inherit the session's) unless an item is clearly mechanical, where
`--model sonnet` is enough.

## Step 4: Write a plan per item

Write each plan **outside** the worktree, which doesn't exist yet:

```bash
PLANS="$HOME/.worktrees/.orchestrate"
mkdir -p "$PLANS"
# one file per item: $PLANS/<name>-plan.md
```

Use `superpowers:writing-plans` for the content. Each plan must stand alone — the
worker Claude gets a fresh context and cannot see this conversation. State the repo,
the ticket, the files to touch, the test command, and what "done" means.

## Step 5: One approval, inline

Show the roster as a table — workspace, repo, base, effort, model, one-line mission —
plus any conflict or scope warnings from step 2. Then use `AskUserQuestion` to confirm:
launch all, launch a subset, or revise the plans.

**Create nothing before the answer.**

## Step 6: Launch the fleet

Check what the local crew supports first — `--detach` and `--prompt` come from
wealthsimple/crew#8 and may not be merged yet:

```bash
crew help 2>&1 | grep -q -- '--prompt' && CREW_HAS_PROMPT=1 || CREW_HAS_PROMPT=
```

Serialize `crew new` per repo — concurrent calls fight over the main checkout's
`index.lock`. Items in *different* repos can go in parallel.

The mission prompt must be **one line**: Claude submits on Enter, so a newline cuts it
short. Keep it short and point at the plan file for detail.

```bash
NAME=DBE-312-eventsimple-cheque-filtering
REPO=~/src/github.com/wealthsimple/digital-branch-eng
EFFORT=high
PLAN="$HOME/.worktrees/.orchestrate/$NAME-plan.md"
MISSION="Copy $PLAN into docs/plans/ then implement it end to end here. Follow the repo's CLAUDE.md, use superpowers:executing-plans, and run the tests. Do NOT commit or push — stop when the plan is done and report what you did, what you skipped, and how to test it."

cd "$REPO"
if [ -n "$CREW_HAS_PROMPT" ]; then
  crew new "$NAME" --detach --effort "$EFFORT" --permission-mode auto --prompt "$MISSION"
else
  # Pre-#8 crew: everything is built before the final attach, which fails
  # harmlessly with "open terminal failed" outside a terminal.
  crew new "$NAME" </dev/null || true
fi

SESS="crew-$(basename "$REPO")-$NAME"
ghostty-tab /opt/homebrew/bin/tmux attach -t "$SESS"
```

Then, only on the fallback path, inject the mission by hand once Claude is up:

```bash
PANE=$(tmux list-panes -t "$SESS" -F '#{pane_id} #{pane_title}' | awk '$2=="claude"{print $1;exit}')
until [ "$(tmux display-message -pt "$PANE" '#{pane_current_command}')" != zsh ]; do sleep 2; done
sleep 2
tmux send-keys -t "$PANE" -l "/effort $EFFORT"; tmux send-keys -t "$PANE" C-m
sleep 1
tmux send-keys -t "$PANE" -l "$MISSION"; tmux send-keys -t "$PANE" C-m
```

`ghostty-tab` needs absolute paths and takes no shell operators — see its header.

## Step 7: Report and stop

Each tab self-colors from the `client-attached` hook. Read the assignments back and
print the roster so the user can find a tab by its dot:

```bash
tmux list-sessions -F '#{@tab_dot}  #{session_name}' | grep -F "$NAME"
```

Report: dot, workspace, ticket, effort, plan path. Then **stop** — don't poll.

If the user later says "status" (or asks how the fleet is doing), re-inspect every
workspace on demand:

```bash
for s in $(tmux list-sessions -F '#{session_name}' | grep '^crew-'); do
  p=$(tmux show-options -qv -t "$s" @crew_claude_pane)
  printf '%s %s: ' "$(tmux show-options -qv -t "$s" @tab_dot)" "$s"
  tmux capture-pane -pt "${p:-$s}" 2>/dev/null | grep -v '^\s*$' | tail -3
done
```

Read each tail: a prompt box means idle or waiting on the user, a spinner means working.
Also check `git -C ~/.worktrees/<repo>/<name> status --short` for actual progress.

## Cleanup

Workers stop before committing. Shipping is the user's call, per workspace — attach and
run `ship-feature` there, or hand the diff to `/code-review` first.

When a workspace is done, from inside its repo:

```bash
crew rm <name> --branch   # drops the session, worktree, and crew/<name> branch
```

`crew rm <name>` alone keeps the branch. Removing the session closes the tab attached
to it.
