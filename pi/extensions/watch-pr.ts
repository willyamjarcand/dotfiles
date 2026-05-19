// /watch-pr — spawn a side-quest pi session that watches a PR until it merges.
//
// Usage:
//   /watch-pr                                — auto-detect PR for the current branch
//   /watch-pr 1234                           — watch PR #1234
//   /watch-pr 1234 --effort high             — override thinking level (default: xhigh)
//   /watch-pr 1234 --model bedrock-claude-opus-4-7
//   /watch-pr 1234 --poll 120                — poll every 120s (default: 300)
//   /watch-pr 1234 --intent "fixing flaky payment tests"
//   /watch-pr stop 1234                      — ask the active watcher for that PR to wind down
//
// What it does:
//   1. Captures recent context from this session (last user messages, branch, commits, ticket key)
//   2. Writes the context to /tmp/pi-watcher-ctx-<pr>.md
//   3. Opens a new tmux window running ~/dotfiles/pi/bin/pi-watch-pr
//   4. The watcher loops the watch-pr skill until CI green + approved + comments addressed
//
// Hard-coded constraint: the watcher NEVER replies on GitHub. It commits or it logs to PR-NOTES.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface WatcherConfig {
  effort: string;
  model: string | null;
  pollSeconds: number;
  intent: string | null;
}

const DEFAULTS: WatcherConfig = {
  effort: "xhigh",
  model: null,
  pollSeconds: 300,
  intent: null,
};

const VALID_EFFORTS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

function sh(cmd: string, opts: { cwd?: string; check?: boolean } = {}): string {
  try {
    return execSync(cmd, {
      cwd: opts.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    }).trim();
  } catch (err) {
    if (opts.check) throw err;
    return "";
  }
}

function parseArgs(raw: string): {
  prNumber: number | null;
  config: WatcherConfig;
  subcommand: "watch" | "stop";
  error?: string;
} {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const config: WatcherConfig = { ...DEFAULTS };
  let prNumber: number | null = null;
  let subcommand: "watch" | "stop" = "watch";

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "stop") {
      subcommand = "stop";
    } else if (t === "--effort" || t === "-e") {
      const next = tokens[++i];
      if (!next || !(VALID_EFFORTS as readonly string[]).includes(next)) {
        return {
          prNumber: null,
          config,
          subcommand,
          error: `--effort must be one of: ${VALID_EFFORTS.join(", ")}`,
        };
      }
      config.effort = next;
    } else if (t === "--model" || t === "-m") {
      config.model = tokens[++i] ?? null;
    } else if (t === "--poll" || t === "-p") {
      const next = parseInt(tokens[++i] ?? "", 10);
      if (Number.isNaN(next) || next < 10) {
        return {
          prNumber: null,
          config,
          subcommand,
          error: "--poll must be an integer >= 10 seconds",
        };
      }
      config.pollSeconds = next;
    } else if (t === "--intent" || t === "-i") {
      // Consume the rest of the tokens as the intent string (allow spaces without quoting)
      config.intent = tokens.slice(i + 1).join(" ").replace(/^"|"$/g, "");
      break;
    } else if (/^\d+$/.test(t)) {
      prNumber = parseInt(t, 10);
    }
  }

  return { prNumber, config, subcommand };
}

function detectPrFromBranch(cwd: string): number | null {
  const out = sh(`gh pr view --json number --jq .number`, { cwd });
  const n = parseInt(out, 10);
  return Number.isNaN(n) ? null : n;
}

function gatherContext(
  pi: ExtensionAPI,
  cwd: string,
  prNumber: number,
  config: WatcherConfig,
): string {
  const branch = sh("git rev-parse --abbrev-ref HEAD", { cwd }) || "(detached)";
  const commits = sh("git log -5 --pretty=format:'%h %s' origin/HEAD..HEAD", { cwd })
    || sh("git log -5 --pretty=format:'%h %s'", { cwd });
  const remote = sh("git config --get remote.origin.url", { cwd });

  // Extract a Jira-style ticket from the branch name (ABC-123 style)
  const ticketMatch = branch.match(/[A-Z][A-Z0-9]+-\d+/);
  const ticket = ticketMatch ? ticketMatch[0] : "";

  // Try to grab the PR title for an extra hint on intent
  const prTitle = sh(`gh pr view ${prNumber} --json title --jq .title`, { cwd });
  const prUrl = sh(`gh pr view ${prNumber} --json url --jq .url`, { cwd });

  // Pull the last few user messages from this session — they're the closest
  // signal of "what is the user actually trying to do here".
  // Falls back to the PR title if no session is available (RPC mode, etc).
  let recentUserMessages = "";
  try {
    // @ts-ignore — extension API surface area on the pi instance varies by version
    const sm = (pi as any).sessionManager ?? null;
    if (sm && typeof sm.getEntries === "function") {
      const entries = sm.getEntries() as Array<any>;
      const userTexts: string[] = [];
      for (let i = entries.length - 1; i >= 0 && userTexts.length < 3; i--) {
        const e = entries[i];
        if (e?.type === "message" && e.message?.role === "user") {
          const content = e.message.content;
          const text = typeof content === "string"
            ? content
            : Array.isArray(content)
              ? content
                .filter((c: any) => c?.type === "text")
                .map((c: any) => c.text)
                .join("\n")
              : "";
          if (text) userTexts.unshift(text.trim().slice(0, 800));
        }
      }
      recentUserMessages = userTexts.join("\n\n---\n\n");
    }
  } catch {
    // Best-effort; context file works fine without it.
  }

  const intent = config.intent
    ?? prTitle
    ?? "(no explicit intent provided — infer from recent commits and the user's recent messages below)";

  return [
    `# watch-pr context for PR #${prNumber}`,
    "",
    `INTENT: ${intent}`,
    `TICKET: ${ticket}`,
    `BRANCH: ${branch}`,
    `PR_URL: ${prUrl}`,
    `PR_TITLE: ${prTitle}`,
    `REMOTE: ${remote}`,
    "",
    "## RECENT_COMMITS (last 5 on this branch)",
    "```",
    commits || "(none)",
    "```",
    "",
    "## RECENT_USER_MESSAGES (from main pi session)",
    "",
    recentUserMessages || "(no session messages captured — use INTENT and RECENT_COMMITS)",
    "",
    "---",
    "",
    "Use this context to judge whether each new PR review comment is relevant to *this* change.",
    "When in doubt, log to PR-NOTES and skip — never reply on GitHub.",
  ].join("\n");
}

function isInsideTmux(): boolean {
  return typeof process.env.TMUX === "string" && process.env.TMUX.length > 0;
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("watch-pr", {
    description: "Spawn a side-quest watcher for a PR (CI/reviews loop, never replies on GitHub)",
    handler: async (rawArgs: string, ctx) => {
      const { prNumber: parsedPr, config, subcommand, error } = parseArgs(rawArgs);
      if (error) {
        ctx.ui.notify(error, "error");
        return;
      }

      // ----- stop subcommand -----
      if (subcommand === "stop") {
        if (!parsedPr) {
          ctx.ui.notify("usage: /watch-pr stop <pr-number>", "error");
          return;
        }
        const stateDir = join(homedir(), ".pi", "agent", "watcher-state");
        mkdirSync(stateDir, { recursive: true });
        writeFileSync(
          join(stateDir, `pr-${parsedPr}.done`),
          `user-stopped at ${new Date().toISOString()}\n`,
        );
        ctx.ui.notify(
          `watch-pr #${parsedPr}: sentinel written. The watcher pane will exit after its current tick.`,
          "info",
        );
        return;
      }

      // ----- watch subcommand -----
      const cwd = ctx.cwd;
      const prNumber = parsedPr ?? detectPrFromBranch(cwd);
      if (!prNumber) {
        ctx.ui.notify(
          "no PR number given and `gh pr view` could not auto-detect one for this branch",
          "error",
        );
        return;
      }

      // Refuse to start a second watcher for the same PR if one is already running.
      const sessionFile = join(
        homedir(),
        ".pi",
        "agent",
        "watcher-sessions",
        `pr-${prNumber}.jsonl`,
      );
      const doneFile = join(homedir(), ".pi", "agent", "watcher-state", `pr-${prNumber}.done`);
      if (existsSync(sessionFile) && !existsSync(doneFile)) {
        const ok = await ctx.ui.confirm(
          "Watcher already running",
          `A watcher session exists for PR #${prNumber}. Start a new one anyway?`,
        );
        if (!ok) return;
      }

      // Write context file
      const ctxFile = `/tmp/pi-watcher-ctx-${prNumber}.md`;
      const ctxBody = gatherContext(pi, cwd, prNumber, config);
      writeFileSync(ctxFile, ctxBody, "utf8");

      const watcherScript = join(homedir(), "dotfiles", "pi", "bin", "pi-watch-pr");
      if (!existsSync(watcherScript)) {
        ctx.ui.notify(
          `watcher script not found at ${watcherScript} — is your dotfiles checkout up to date?`,
          "error",
        );
        return;
      }

      const env = {
        PR: String(prNumber),
        CTX_FILE: ctxFile,
        EFFORT: config.effort,
        MODEL: config.model ?? "",
        POLL_SECONDS: String(config.pollSeconds),
        REPO_ROOT: cwd,
      };

      // ----- spawn -----
      if (isInsideTmux()) {
        const args = [
          "new-window",
          "-d", // don't switch focus — user keeps working
          "-n", `watch-pr-${prNumber}`,
        ];
        for (const [k, v] of Object.entries(env)) {
          args.push("-e", `${k}=${v}`);
        }
        args.push(watcherScript);

        const result = spawnSync("tmux", args, { stdio: "inherit" });
        if (result.status !== 0) {
          ctx.ui.notify(
            `tmux new-window exited with status ${result.status}`,
            "error",
          );
          return;
        }
        ctx.ui.notify(
          `watch-pr #${prNumber} spawned in tmux window 'watch-pr-${prNumber}' (effort=${config.effort}, poll=${config.pollSeconds}s). Notes: ${cwd}/PR-NOTES-${prNumber}.md`,
          "success",
        );
      } else {
        // No tmux — print a copy-paste command so the user can run it elsewhere.
        const envExports = Object.entries(env)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(" ");
        ctx.ui.notify(
          [
            "Not inside tmux. Run this in a separate terminal pane:",
            "",
            `${envExports} ${watcherScript}`,
          ].join("\n"),
          "info",
        );
      }
    },

    getArgumentCompletions: (prefix: string) => {
      const flags = [
        "--effort",
        "--model",
        "--poll",
        "--intent",
        "stop",
        ...VALID_EFFORTS,
      ];
      const matches = flags
        .filter((f) => f.startsWith(prefix.trim()))
        .map((value) => ({ value, label: value }));
      return matches.length > 0 ? matches : null;
    },
  });
}
