# overnight-team

A skill for running an autonomous game-dev team overnight in a git worktree, driven by `pi-overnight` (in `~/dotfiles/pi/bin/`).

## What it does

The wrapper script ticks pi once per loop iteration, with this skill loaded. Each tick the agent:

1. Reads `.overnight/STATE.md` to learn the current state and which "hat" to wear
2. Acts as one role (producer / game designer / sprite designer / coder / playtester)
3. Does ONE step (don't get greedy)
4. Commits, logs to `NIGHT_LOG.md`, updates `STATE.md`
5. Exits — wrapper invokes pi again as a fresh process

## State machine

`PLANNING → DESIGNING → DRAWING → CODING → PLAYTESTING → DONE` (with PLAYTESTING → CODING loops for fixes).

DRAWING is skipped if the feature has no visual component.

## MVP scope

v1 ships **one feature, end to end** and stops. Stop conditions (any one):

- `.overnight/DONE` exists (feature shipped)
- `.overnight/STOP` exists (user kill switch)
- Wall clock past deadline (`--until` or `--max-hours`)
- `--max-iters` exceeded

## Usage

```bash
~/dotfiles/pi/bin/pi-overnight /path/to/repo
~/dotfiles/pi/bin/pi-overnight /path/to/repo --until 09:00 --max-hours 8
~/dotfiles/pi/bin/pi-overnight /path/to/repo --max-iters 5  # short test
~/dotfiles/pi/bin/pi-overnight /path/to/repo --dry-run      # scaffold only
```

## Reading the morning summary

Everything you need is in `.overnight/NIGHT_LOG.md` in the worktree. Each tick adds one entry showing which hat acted and what they decided. Skim top-to-bottom.

## Future (v2+) ideas

- Real sub-agent dispatch instead of one-agent-many-hats (sub-agents get clean context per role)
- Multi-feature mode (drop the DONE-stops-loop assumption)
- A reviewer hat with veto power before commits
- Automatic playtesting via headless game runner where possible
- Cost cap (`--max-cost $X`)
- Notification when DONE / when stuck
