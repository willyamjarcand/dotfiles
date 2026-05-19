---
name: watch-pr
description: Watch a GitHub PR and address review comments by committing fixes (when relevant) or logging an explanation (when not). NEVER replies on GitHub. Loops until CI is green, the PR is approved, and no unresolved comments remain. Invoked by the spawn-watcher extension as a side-quest agent.
---

# watch-pr

A long-running side-quest agent invoked once per "tick" via `pi --session ... -p "/skill:watch-pr <phase> <pr#>"`.

The watcher session is **isolated** from the main pi session — its only memory is its own session log and the state files it writes to disk. The wrapper script `pi-watch-pr` calls this skill repeatedly until the watcher writes a `.done` sentinel.

## Hard rules (do not violate)

1. **NEVER reply on GitHub.** Do not call `gh pr review`, `gh pr comment`, `gh api .../reviews/.../comments`, `gh pr review --comment`, or anything that posts to GitHub conversation threads. The user will reply themselves.
2. **NEVER resolve threads on GitHub.** No `gh api graphql` mutations to mark threads resolved.
3. **NEVER force-push.** Use plain `git push`. If a force-push is genuinely needed (e.g. rebase to fix conflicts), STOP and write to the notes file asking the user to take over.
4. **NEVER touch unrelated code.** Each commit must address one specific review comment or CI failure.
5. **NEVER assume.** If a comment is ambiguous, log it to the notes file and skip — do not guess intent.

## Phases

You are invoked with one of three phases:

```
/skill:watch-pr init <pr-number>
/skill:watch-pr tick <pr-number>
/skill:watch-pr stop <pr-number>
```

Arguments after the phase are passed via `$ARGUMENTS` from the user-invoked prompt. The wrapper script also passes a context file via `@/tmp/pi-watcher-ctx-<pr>.md` on `init` — read it once, then it lives in your session memory.

### Phase: `init`

First invocation. The user's main agent has just spawned you. The wrapper has attached `/tmp/pi-watcher-ctx-<pr>.md` containing what the user was working on.

Do these steps in order:

1. **Read the context file** (already attached). Internalize:
   - `INTENT` — one-line summary of what the change is
   - `TICKET` — Jira key (may be empty)
   - `BRANCH` — git branch name
   - `RECENT_COMMITS` — last few commits from the branch
   - `RECENT_USER_MESSAGES` — what the user was telling the main agent

2. **Confirm the PR exists and matches the branch:**
   ```bash
   gh pr view <PR> --json number,headRefName,title,url,state
   ```
   If `headRefName` does not match `BRANCH`, abort and write to notes:
   > "PR #<n> head branch is `<x>` but watcher was spawned with branch `<y>`. Refusing to act."

3. **Initialize the notes file** at `<repo-root>/PR-NOTES-<pr>.md` (create if missing):
   ```markdown
   # PR #<pr> watcher notes

   Intent: <INTENT>
   Ticket: <TICKET>
   Branch: <BRANCH>
   Watcher started: <ISO timestamp>

   ---
   ```
   Add `PR-NOTES-*.md` to `.gitignore` if not already present (use `git check-ignore` first; if not ignored, append the pattern but DO NOT commit the .gitignore change — leave it staged for the user).

4. **Run one full tick** (jump to the tick procedure below).

5. **Print a single-line summary** to stdout so the user sees it in the tmux pane:
   ```
   [watch-pr #<pr> init] CI: <state>  Reviews: <state>  Comments: <n new, n addressed, n logged>  Next tick in <N>s
   ```

### Phase: `tick`

One iteration of the watch loop. The session has memory of every prior tick — use it.

Procedure:

1. **Fetch state:**
   ```bash
   gh pr view <PR> --json number,state,mergeable,reviewDecision,statusCheckRollup,reviewThreads,comments,commits,headRefOid,url
   gh pr checks <PR> --json name,state,conclusion,detailsUrl
   ```

2. **Diff against last tick.** From session memory you know which comment IDs and which CI check states you already handled. New things to consider this tick:
   - **New review comments** (any `comment.id` not yet evaluated)
   - **New CI failures** (any check that flipped from `pending`/`success` to `failure` since last tick)
   - **Resolved threads** (no action needed; just note)

3. **For each new review comment**, decide:

   **Relevant** = the comment is asking for a change to *this* PR's code that aligns with `INTENT`. Examples:
   - "this nil check is missing"
   - "extract this into a helper"
   - "this test doesn't cover the X branch"
   - "rename `foo` to `bar` for consistency with the rest of the file"

   **NOT relevant** = anything else, including:
   - Pre-existing tech debt the reviewer is mentioning in passing ("we should refactor this someday")
   - Out-of-scope suggestions ("while you're here, could you also...")
   - Style-only nits the team has not codified
   - Questions seeking clarification (the user will answer those)
   - Praise / non-actionable comments
   - Anything ambiguous — when in doubt, NOT relevant

   **If relevant:**
   - Pull the latest branch (`git fetch && git checkout <BRANCH> && git pull --ff-only`).
   - Make the smallest possible change that addresses the comment.
   - Run the relevant tests/linter for the touched files. If they fail, iterate up to 3 times. If still failing, log to notes and skip.
   - Commit with message: `<type>(<TICKET>): address review feedback — <one-line summary>` and a body quoting the relevant portion of the comment (with `> ` prefix). Include `Refs: <comment-url>`.
   - `git push` (no force).
   - Append a `### Addressed` entry in the notes file with: comment URL, reviewer, summary, commit SHA.

   **If NOT relevant:**
   - Do NOT modify code.
   - Append a `### Skipped (not relevant)` entry in the notes file with: comment URL, reviewer, full comment body, and a 1–3 sentence explanation pointing back to `INTENT`.

4. **For each new CI failure:**
   - Fetch logs (`gh run view <run-id> --log-failed` or `gh pr checks <PR>` to find the run).
   - Read the failure. If it's caused by *this* PR's changes (most cases), fix it with the smallest possible change, commit, push.
   - If it's caused by something outside this PR's scope (flaky test unrelated to changed files, infra outage, wrong base branch), do NOT touch code. Log to notes:
     > "CI failure in `<job>` appears unrelated to this PR's changes (see <log-url>). Skipping; please investigate manually or rerun if flaky."

5. **Check stop conditions.** All of the following must be true:
   - `statusCheckRollup` shows all required checks `SUCCESS` (skip optional/manual ones the user hasn't enabled).
   - `reviewDecision` is `APPROVED`.
   - `reviewThreads` has zero unresolved threads from humans (bots can be ignored if they auto-resolve).
   - No new comments were posted since the last fetch in this tick.

   If all true:
   - Write `~/.pi/agent/watcher-state/pr-<pr>.done` with a one-line summary.
   - Append final `## Done` entry to notes file with timestamp and merge-readiness summary.
   - Print: `[watch-pr #<pr> done] All clear — CI green, approved, no unresolved comments.`
   - Exit (the wrapper script will see the sentinel and stop polling).

6. **Otherwise, print the status line:**
   ```
   [watch-pr #<pr> tick <N>] CI: <state>  Reviews: <state>  Comments: <n new this tick, n addressed total, n logged total>  Next tick in <S>s
   ```

### Phase: `stop`

User invoked `/watch-pr stop <pr>` from the main session, or hit Ctrl+C in the tmux pane.

Steps:
1. Append `## Stopped` to the notes file with timestamp and current state.
2. Write `~/.pi/agent/watcher-state/pr-<pr>.done` with reason `user-stopped`.
3. Print `[watch-pr #<pr> stopped] State preserved at <notes-path>.` and exit.

## State you maintain across ticks

Your session log IS your state — pi persists it via `--session <path>`. You do NOT need a separate state file for "have I seen this comment before"; just check session memory.

The only on-disk state files are:

| File | Purpose |
|---|---|
| `<repo>/PR-NOTES-<pr>.md` | Human-readable log; the user reads this |
| `~/.pi/agent/watcher-state/pr-<pr>.done` | Sentinel — wrapper script polls for this to know when to stop |

## Tooling reference

```bash
# Fetch PR state (use --json to keep tokens low)
gh pr view <PR> --json number,state,mergeable,reviewDecision,statusCheckRollup,reviewThreads,comments,commits,headRefOid,url,title

# CI check details
gh pr checks <PR> --json name,state,conclusion,detailsUrl
gh run view <run-id> --log-failed

# Branch ops
git fetch origin
git checkout <branch>
git pull --ff-only
git add <specific files>
git commit -m "..."
git push
```

## When to stop and ask the user

Write to notes and stop polling (write the `.done` sentinel with reason `needs-user`) if:
- Force-push would be required.
- A merge conflict appears that's non-trivial.
- A reviewer asks a direct question (this is "not relevant" for committing, but you should also surface it prominently).
- Same CI failure persists after 3 fix attempts.
- You'd need to modify >50 lines for a single comment (probably scope creep).
- The PR's base branch has been changed.

Always leave the user a clear path to take over — don't silently abandon work.
