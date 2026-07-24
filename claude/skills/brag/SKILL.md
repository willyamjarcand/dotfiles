---
name: brag
description: >
  Use when the user just accomplished something brag-worthy and wants to document it.
  Invoked via /brag or when the user says they want to log an accomplishment, add to their
  brag doc, or record a win. Gathers context from the conversation, git activity, and user
  input, then publishes a month-grouped, role-skill-tagged entry to their Notion brag doc.
---

# Brag — Accomplishment Logger

Documents accomplishments in a Notion brag doc organized **Month → Project → Role skill**.
Each entry lives under a month-level heading and is tagged inline with one or more
Wealthsimple IC competencies (the "Role skills"). A Competency Coverage table at the bottom
of the doc tallies entries per skill so gaps stay visible.

## Bar for inclusion

Only log entries with cross-team or system-level impact. Examples that clear the bar:

- Designed or owned a feature/system end-to-end (multi-PR, multi-week, multi-repo)
- Drove a multi-team incident or post-mortem with quantified recovery
- Authored a structured artifact the rest of the team uses (risk audit, design doc, RFC)
- Sustained mentorship recognized by peers

**Skip standalone entries for:**

- Small tooling changes or cleanups (≤2 PRs, no broader narrative)
- Single-PR follow-ups to existing entries — fold them as `**Follow-up shipped**:` or as
  additional Evidence on the original entry instead
- Pure exploration without a shipped artifact

Heuristic: "Would the user cite this in a promo packet?" If no, skip it or fold it into a
related entry.

## Step 1: Load persistent context

Read `~/.config/brag/`:

| File | Purpose |
|------|---------|
| `profile.md` | User's current level, goals, improvement areas, strengths |
| `role_matrix.md` | Wealthsimple IC competency expectations (current + next level) |
| `feedback.md` | Historical feedback summary from review cycles |
| `notion_config.md` | Notion page IDs for the brag doc and current quarter page |

If `~/.config/brag/` is missing or incomplete, trigger **First-Run Setup** (see bottom).

## Step 2: Gather context

### A) Conversation
Look for recent tool calls (file edits, test runs, deployments), PRs created or merged,
design decisions, problems solved.

### B) Git activity
```bash
git log --oneline --author="$(git config user.name)" --since="3 weeks ago" -50
gh pr list --author @me --state all --limit 10 2>/dev/null
```

If running from a parent repo with submodules (e.g. fort-knox, front-end-monorepo), scan
each submodule.

### C) User input

> "I've gathered context from our session and your git history. Anything to add about the
> **impact** or **context** that isn't in the code? (Skip if it's all there.)"

If the user skips, proceed with what you have.

## Step 3: Draft the entry

### Required fields

- **Date**: `YYYY-MM-DD` — completion date or date of last meaningful PR
- **Title**: One line, action-verb led; include ticket prefix if applicable (e.g. `DBE-498`)
- **Role skills**: Primary competency, then any secondaries — separated by `·`
- **What**: Bullet list (3–6 bullets) describing what was done
- **Impact**: Bullet list of business / team / user / reliability outcomes, quantified
- **Growth** *(optional)*: One-line link to a 2026 goal or feedback area
- **Evidence**: PR / ticket / design doc / dashboard links — comma-separated

### Style rules

- **Bullets, not prose.** What and Impact are bullet lists. Growth and Evidence are single lines.
- **Lead with action verbs**: "designed", "shipped", "led", "recovered", "authored".
- **Quantify**: dollars recovered, PRs shipped, time saved, teams unblocked, % reduction.
- **Senior framing where genuine.** Don't inflate.
- **Concise.** If a bullet runs over two lines, it's prose pretending to be a bullet — split it
  or shorten it.

### Notion entry format

```
<details>
<summary>**[YYYY-MM-DD] Title of accomplishment**</summary>
	**Role skills**: <Primary> (primary) · <Secondary> · <Tertiary>

	**What**:
	- bullet
	- bullet
	- bullet

	**Impact**:
	- bullet
	- bullet

	**Growth**: One-line link to a goal or improvement area. (Optional.)

	**Evidence**: [PR #N](url), [ticket](url), design doc path
</details>
```

Use markdown bold (`**…**`) inside `<summary>`, **not** `<b>…</b>`. Notion does not parse
inline HTML inside `<details>` summaries — it renders the literal tags. Body lines are
tab-indented under the summary.

## Step 4: Review and publish

1. Show the drafted entry in the terminal.
2. Ask: *"Does this look right? Want to adjust anything before I add it to Notion?"*
3. On approval, fetch the current quarter page using `mcp__notion__notion-fetch`.
4. Determine where to insert:
   - Locate the matching `## <Month YYYY>` heading (e.g. `## April 2026`). If absent, create
     one as a new section. Months are sorted newest-first.
   - Insert the new entry **above** existing entries from the same month (newest-first within
     month).
5. Update the **Competency Coverage** table at the bottom: increment the count for every Role
   skill the entry lists (primary + secondaries). If a category goes from 0 → ≥1, change
   Status from `—` to `✔️`. Update the line above the table (`N unique entries spanning M
   of 16 competencies`).

### Notion MCP tools

| Tool | Usage |
|------|-------|
| `mcp__notion__notion-fetch` | Read current quarter page |
| `mcp__notion__notion-update-page` (`update_content`) | Surgical inserts and table bumps — preferred |
| `mcp__notion__notion-update-page` (`replace_content`) | Reserve for major restructures |
| `mcp__notion__notion-search` | Locate pages if IDs are missing |
| `mcp__notion__notion-create-pages` | Create new quarter page |

### Quarter rollover

- Q1: Jan 1 – Mar 31
- Q2: Apr 1 – Jun 30
- Q3: Jul 1 – Sep 30
- Q4: Oct 1 – Dec 31

If `notion_config.md` references a different quarter than today's date, create a new
quarterly page as a child of the parent brag doc page and update `notion_config.md`. New
quarter pages start with just the Competency Coverage table (all zeros) — months populate
as entries are added.

## Step 5: Gap analysis

Each entry contributes 1 to every Role skill it lists (primary + secondaries). Parse each
entry's `**Role skills**:` line to compute counts.

Present in the terminal:

```
Gap Analysis — Q2 2026 (N unique entries spanning M of 16 competencies)

Execution / Business Impact
  ○ Strategic Alignment & Business ROI .. 0   ← gap
  ● Problem Solving ..................... 1
  ● Execution (Velocity, Quality) ....... 2
  ● Interdependency Coordination ........ 1
  ● Navigating Risk ..................... 2

Technical Leadership
  ● Technical Influence ................. 1
  ● Improve How We Work ................. 1
  ● Cross-functional Partnership ........ 1
  ● End-to-End Ownership ................ 3   ⭐ DRI goal
  ○ Innovation .......................... 0   ← gap
  ○ Team Centric Leadership ............. 0   ← gap

Mastery of Craft
  ● Technical Depth ..................... 3
  ● Mentorship .......................... 1
  ● Communication & Feedback ............ 1
  ● Navigates Complexity & Ambiguity .... 1
  ○ Lives the Wealthsimple Values ....... 0   ← gap
```

Then add 2–3 specific suggestions tied to the user's `profile.md` goals and `feedback.md`
growth areas. Be concrete: "look for a moment where you mediated a design disagreement —
that's a Team Centric Leadership candidate" beats "fill the Team Centric Leadership gap".

---

## First-Run Setup

If `~/.config/brag/` is missing or incomplete:

1. `mkdir -p ~/.config/brag`
2. If `role_matrix.md` is missing, check for the Wealthsimple CSV in Downloads:
   ```bash
   ls ~/Downloads/Data*Engineering*Role*Expectations*.csv 2>/dev/null
   ```
   If found, parse it into `role_matrix.md` (Level 2 + Senior columns). Else create a
   template and ask the user to paste their role expectations.
3. Create `profile.md` template if missing — ask for level, team, 2026 goals.
4. Create `feedback.md` template if missing — ask the user to paste in review-cycle feedback
   later.
5. Search Notion for an existing brag doc; if missing, ask where to create quarterly pages.
6. Create the current quarter's Notion page as a child of the parent brag doc, seeded with
   only the **Competency Coverage** table (all zeros). Months populate as entries are added.
7. Save all IDs to `notion_config.md`.

---

## Updating config files

After significant sessions, update `~/.config/brag/profile.md` if you learn new information
about the user's goals, strengths, or improvement areas. Keep it current.
