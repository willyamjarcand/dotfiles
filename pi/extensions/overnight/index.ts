/**
 * Overnight Team Extension
 *
 * Runs an autonomous game-dev team in a worktree, in the background, while you
 * continue using pi normally. The actual loop lives in `pi-overnight` (bash);
 * this extension is a thin UI wrapper around it.
 *
 * Commands:
 *   /overnight              -> alias for /overnight status
 *   /overnight start [path] -> spawn the loop on `path` (defaults to ctx.cwd)
 *                              flags: --until HH:MM, --max-hours N, --max-iters N
 *   /overnight status       -> show whether a session is running, where, and current state
 *   /overnight stop         -> graceful stop (touch .overnight/STOP)
 *   /overnight kill         -> SIGTERM the wrapper process
 *   /overnight tail [N]     -> show last N entries from NIGHT_LOG.md (default 5)
 *   /overnight log          -> print full path to NIGHT_LOG.md
 *
 * State is persisted to ~/.pi/overnight/current.json so commands survive
 * restarts of pi.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import {
	appendFileSync,
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const STATE_DIR = join(homedir(), ".pi", "overnight");
const STATE_FILE = join(STATE_DIR, "current.json");
const PREFS_DIR = join(STATE_DIR, "preferences");
const SCRIPT_PATH = join(homedir(), "dotfiles", "pi", "bin", "pi-overnight");

const HATS = [
	"general",
	"producer",
	"game-designer",
	"sprite-designer",
	"coder",
	"playtester",
] as const;
type Hat = (typeof HATS)[number];

interface SessionState {
	pid: number;
	repo: string;
	worktree: string;
	branch: string;
	dateTag: string;
	logFile: string;
	startedAt: number;
	args: string[];
}

function ensureStateDir() {
	if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function loadState(): SessionState | null {
	if (!existsSync(STATE_FILE)) return null;
	try {
		return JSON.parse(readFileSync(STATE_FILE, "utf8"));
	} catch {
		return null;
	}
}

function saveState(s: SessionState | null) {
	ensureStateDir();
	if (s === null) {
		if (existsSync(STATE_FILE)) writeFileSync(STATE_FILE, "");
	} else {
		writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
	}
}

function isAlive(pid: number): boolean {
	try {
		// Signal 0 = check existence without sending a signal.
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function tailFile(path: string, maxBytes = 16384): string {
	if (!existsSync(path)) return "";
	const stat = statSync(path);
	if (stat.size <= maxBytes) return readFileSync(path, "utf8");
	const fd = openSync(path, "r");
	const buf = Buffer.alloc(maxBytes);
	readSync(fd, buf, 0, maxBytes, stat.size - maxBytes);
	closeSync(fd);
	return buf.toString("utf8");
}

function lastNLogEntries(logPath: string, n: number): string {
	const text = tailFile(logPath, 64 * 1024);
	if (!text) return "(no log entries yet)";
	// Entries start with "## "
	const parts = text.split(/^## /m);
	const entries = parts
		.slice(1) // drop preamble
		.map((p) => `## ${p.trimEnd()}`);
	return entries.slice(-n).join("\n\n") || "(no entries yet)";
}

function readStateMd(worktree: string): Record<string, string> | null {
	const path = join(worktree, ".overnight", "STATE.md");
	if (!existsSync(path)) return null;
	const text = readFileSync(path, "utf8");
	const out: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const m = line.match(/^(state|feature|iteration|last_hat|next_hat):\s*(.+)$/);
		if (m) out[m[1]] = m[2].trim();
	}
	return out;
}

function dateTag(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function parseStartArgs(raw: string[]): {
	repoArg: string | null;
	flags: string[];
} {
	const flags: string[] = [];
	let repoArg: string | null = null;
	for (let i = 0; i < raw.length; i++) {
		const t = raw[i];
		if (t.startsWith("--")) {
			flags.push(t);
			// flags that take a value
			if (
				["--until", "--max-hours", "--max-iters", "--worktree"].includes(t) &&
				raw[i + 1] !== undefined
			) {
				flags.push(raw[i + 1]);
				i++;
			}
		} else if (repoArg === null) {
			repoArg = t;
		}
	}
	return { repoArg, flags };
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("overnight", {
		description:
			"Autonomous overnight game-dev team in a worktree (start|status|stop|kill|tail|log)",
		getArgumentCompletions: (prefix) => {
			const subs = [
				"start",
				"resume",
				"status",
				"stop",
				"kill",
				"tail",
				"log",
				"shipped",
				"clean",
				"prefer",
				"prefs",
				"onboard",
			];
			const filtered = subs.filter((s) => s.startsWith(prefix));
			return filtered.length > 0
				? filtered.map((s) => ({ value: s, label: s }))
				: null;
		},
		handler: async (args, ctx) => {
			const tokens = args.trim().split(/\s+/).filter(Boolean);
			const sub = tokens[0] || "status";
			const rest = tokens.slice(1);

			switch (sub) {
				case "status":
					return showStatus(ctx);
				case "start":
					return start(rest, ctx);
				case "resume":
					return resume(rest, ctx);
				case "stop":
					return stop(ctx);
				case "kill":
					return kill(ctx);
				case "tail":
					return tail(rest, ctx);
				case "log":
					return showLogPath(ctx);
				case "shipped":
					return shipped(rest, pi, ctx);
				case "clean":
					return clean(rest, ctx);
				case "prefer":
					return prefer(rest, ctx);
				case "prefs":
					return prefs(rest, ctx);
				case "onboard":
					return onboard(rest, pi, ctx);
				default:
					ctx.ui.notify(
						`unknown subcommand: ${sub}. try: start | resume | status | stop | kill | tail | log | shipped | clean | prefer | prefs | onboard`,
						"error",
					);
			}
		},
	});

	// Refresh footer/widget on session start so resumed pi sessions know about a running loop.
	pi.on("session_start", async (_event, ctx) => {
		const s = loadState();
		if (s && isAlive(s.pid)) {
			ctx.ui.setStatus("overnight", `🌙 overnight running (pid ${s.pid})`);
		}
	});
}

// Find the most recent overnight worktree for `repo`, scanning the repo's
// parent directory for `<basename(repo)>-overnight-*` directories and picking
// the newest by mtime. Returns null if none found.
function findLatestWorktree(repo: string): string | null {
	const parent = dirname(repo);
	const prefix = `${basename(repo)}-overnight-`;
	const fs = require("node:fs") as typeof import("node:fs");
	let entries: string[];
	try {
		entries = fs.readdirSync(parent);
	} catch {
		return null;
	}
	const candidates = entries
		.filter((name) => name.startsWith(prefix))
		.map((name) => join(parent, name))
		.filter((path) => existsSync(join(path, ".overnight", "STATE.md")))
		.map((path) => ({ path, mtime: fs.statSync(path).mtimeMs }))
		.sort((a, b) => b.mtime - a.mtime);
	return candidates[0]?.path ?? null;
}

async function start(rawArgs: string[], ctx: any): Promise<void> {
	if (!existsSync(SCRIPT_PATH)) {
		ctx.ui.notify(`pi-overnight script not found at ${SCRIPT_PATH}`, "error");
		return;
	}

	const existing = loadState();
	if (existing && isAlive(existing.pid)) {
		ctx.ui.notify(
			`overnight already running (pid ${existing.pid}). use /overnight status or /overnight kill.`,
			"warning",
		);
		return;
	}

	const { repoArg, flags } = parseStartArgs(rawArgs);
	const repo = resolve(repoArg ?? ctx.cwd);

	if (!existsSync(join(repo, ".git"))) {
		ctx.ui.notify(`${repo} is not a git repo`, "error");
		return;
	}

	const tag = dateTag();
	const worktree = join(dirname(repo), `${basename(repo)}-overnight-${tag}`);
	const branch = `overnight/${tag}`;

	ensureStateDir();
	const logFile = join(STATE_DIR, `${tag}.log`);
	const out = openSync(logFile, "a");
	const err = openSync(logFile, "a");

	const scriptArgs = [repo, ...flags];

	// On macOS, wrap with `caffeinate -i` so idle sleep doesn't kill the loop.
	// `-i` prevents idle system sleep while caffeinate is alive; it dies when
	// pi-overnight exits, so power management returns to normal automatically.
	// (Lid-closed sleep on Apple Silicon is not preventable this way — see README.)
	const noCaffeinate = process.env.PI_OVERNIGHT_NO_CAFFEINATE === "1";
	const useCaffeinate = process.platform === "darwin" && !noCaffeinate;
	const spawnCmd = useCaffeinate ? "caffeinate" : SCRIPT_PATH;
	const spawnArgs = useCaffeinate ? ["-i", SCRIPT_PATH, ...scriptArgs] : scriptArgs;

	const child = spawn(spawnCmd, spawnArgs, {
		detached: true,
		stdio: ["ignore", out, err],
		cwd: dirname(repo),
		env: process.env,
	});
	child.unref();

	if (!child.pid) {
		ctx.ui.notify("failed to spawn pi-overnight", "error");
		return;
	}

	const state: SessionState = {
		pid: child.pid,
		repo,
		worktree,
		branch,
		dateTag: tag,
		logFile,
		startedAt: Date.now(),
		args: scriptArgs,
	};
	saveState(state);

	ctx.ui.setStatus("overnight", `🌙 overnight running (pid ${child.pid})`);
	const caffeinateNote = useCaffeinate
		? "\n  (idle sleep prevented via caffeinate — close lid for sleep)"
		: "";
	ctx.ui.notify(
		`overnight started:\n  pid: ${child.pid}\n  repo: ${repo}\n  worktree: ${worktree}\n  log: ${logFile}${caffeinateNote}\n\nuse /overnight status to check in.`,
		"success",
	);
}

async function resume(rawArgs: string[], ctx: any): Promise<void> {
	if (!existsSync(SCRIPT_PATH)) {
		ctx.ui.notify(`pi-overnight script not found at ${SCRIPT_PATH}`, "error");
		return;
	}

	const existing = loadState();
	if (existing && isAlive(existing.pid)) {
		ctx.ui.notify(
			`overnight already running (pid ${existing.pid}). use /overnight status or /overnight kill first.`,
			"warning",
		);
		return;
	}

	const { repoArg, flags } = parseStartArgs(rawArgs);

	// Resolution order:
	//   1. explicit repo arg
	//   2. saved state's repo (most recent session)
	//   3. ctx.cwd if it's a git repo
	let repo: string | null = null;
	if (repoArg) {
		repo = resolve(repoArg);
	} else if (existing?.repo) {
		repo = existing.repo;
	} else if (existsSync(join(ctx.cwd, ".git"))) {
		repo = ctx.cwd;
	}

	if (!repo) {
		ctx.ui.notify(
			`couldn't figure out which repo to resume.\nusage: /overnight resume [repo-path]`,
			"error",
		);
		return;
	}
	if (!existsSync(join(repo, ".git"))) {
		ctx.ui.notify(`${repo} is not a git repo`, "error");
		return;
	}

	const worktree = findLatestWorktree(repo);
	if (!worktree) {
		ctx.ui.notify(
			`no existing overnight worktree found for ${repo}.\nuse /overnight start to begin a new session.`,
			"warning",
		);
		return;
	}

	// Derive branch from the worktree itself.
	let branch = "";
	try {
		const { execSync } = require("node:child_process") as typeof import("node:child_process");
		branch = execSync(`git -C ${JSON.stringify(worktree)} rev-parse --abbrev-ref HEAD`, {
			encoding: "utf8",
		}).trim();
	} catch {
		// fall back to a guess; wrapper will derive branch internally too
		branch = `overnight/(unknown)`;
	}

	// Pull dateTag from the worktree name suffix (best-effort, just for log file).
	const tagMatch = basename(worktree).match(/-overnight-(.+)$/);
	const tag = tagMatch?.[1] ?? dateTag();

	ensureStateDir();
	const logFile = join(STATE_DIR, `${tag}.log`);
	const out = openSync(logFile, "a");
	const err = openSync(logFile, "a");

	// Pass --worktree so the script reuses the existing one. Repo is still required.
	const scriptArgs = [repo, "--worktree", worktree, ...flags];

	const noCaffeinate = process.env.PI_OVERNIGHT_NO_CAFFEINATE === "1";
	const useCaffeinate = process.platform === "darwin" && !noCaffeinate;
	const spawnCmd = useCaffeinate ? "caffeinate" : SCRIPT_PATH;
	const spawnArgs = useCaffeinate ? ["-i", SCRIPT_PATH, ...scriptArgs] : scriptArgs;

	const child = spawn(spawnCmd, spawnArgs, {
		detached: true,
		stdio: ["ignore", out, err],
		cwd: dirname(repo),
		env: process.env,
	});
	child.unref();

	if (!child.pid) {
		ctx.ui.notify("failed to spawn pi-overnight", "error");
		return;
	}

	const state: SessionState = {
		pid: child.pid,
		repo,
		worktree,
		branch,
		dateTag: tag,
		logFile,
		startedAt: Date.now(),
		args: scriptArgs,
	};
	saveState(state);

	ctx.ui.setStatus("overnight", `🌙 overnight running (pid ${child.pid})`);
	ctx.ui.notify(
		`🌙 resumed:\n  pid: ${child.pid}\n  worktree: ${worktree}\n  branch: ${branch}\n  log: ${logFile}\n\nuse /overnight status to check in.`,
		"success",
	);
}

async function showStatus(ctx: any): Promise<void> {
	const s = loadState();
	if (!s) {
		ctx.ui.notify("no overnight session recorded.\n\nstart one with /overnight start", "info");
		return;
	}

	const alive = isAlive(s.pid);
	const stateMd = readStateMd(s.worktree);

	const lines: string[] = [];
	lines.push(`overnight session — ${alive ? "🌙 running" : "💤 not running"}`);
	lines.push(`  pid:       ${s.pid}${alive ? "" : " (dead)"}`);
	lines.push(`  started:   ${new Date(s.startedAt).toLocaleString()}`);
	lines.push(`  repo:      ${s.repo}`);
	lines.push(`  worktree:  ${s.worktree}`);
	lines.push(`  branch:    ${s.branch}`);
	lines.push(`  log:       ${s.logFile}`);
	if (stateMd) {
		lines.push("");
		lines.push("current STATE.md:");
		lines.push(`  state:     ${stateMd.state ?? "?"}`);
		lines.push(`  feature:   ${stateMd.feature ?? "?"}`);
		lines.push(`  iteration: ${stateMd.iteration ?? "?"}`);
		lines.push(`  last hat:  ${stateMd.last_hat ?? "?"}`);
		lines.push(`  next hat:  ${stateMd.next_hat ?? "?"}`);
	}

	const shippedFiles = listShippedFiles(s.worktree);
	const legacyShipped = join(s.worktree, ".overnight", "SHIPPED.md");
	const hasLegacy = existsSync(legacyShipped);
	const totalShipped = shippedFiles.length + (hasLegacy ? 1 : 0);

	if (totalShipped > 0) {
		lines.push("");
		lines.push(`🚀 shipped this night: ${totalShipped} feature${totalShipped === 1 ? "" : "s"}`);
		for (const f of shippedFiles) lines.push(`  • ${basename(f)}`);
		if (hasLegacy) lines.push(`  • SHIPPED.md (legacy)`);
		lines.push("  (use /overnight shipped to read them)");
	}

	const doneFile = join(s.worktree, ".overnight", "DONE");
	if (existsSync(doneFile)) {
		lines.push("\n🌙 night is over (DONE file present)");
	}

	if (!alive) {
		ctx.ui.setStatus("overnight", "");
	}

	ctx.ui.notify(lines.join("\n"), "info");
}

async function stop(ctx: any): Promise<void> {
	const s = loadState();
	if (!s) {
		ctx.ui.notify("no overnight session to stop", "warning");
		return;
	}
	const stopFile = join(s.worktree, ".overnight", "STOP");
	try {
		writeFileSync(stopFile, `stopped by /overnight stop at ${new Date().toISOString()}\n`);
		ctx.ui.notify(
			`graceful stop requested. wrapper will exit after the current tick finishes.\n${stopFile}`,
			"info",
		);
	} catch (e: any) {
		ctx.ui.notify(`could not write STOP file: ${e.message}`, "error");
	}
}

async function kill(ctx: any): Promise<void> {
	const s = loadState();
	if (!s) {
		ctx.ui.notify("no overnight session to kill", "warning");
		return;
	}
	if (!isAlive(s.pid)) {
		ctx.ui.notify(`pid ${s.pid} is not running`, "warning");
		ctx.ui.setStatus("overnight", "");
		return;
	}
	const ok = await ctx.ui.confirm(
		"kill overnight?",
		`SIGTERM pid ${s.pid}. The current pi -p tick may abort mid-action and the worktree could have an uncommitted change. Prefer /overnight stop unless something is wrong. Continue?`,
	);
	if (!ok) return;
	try {
		process.kill(s.pid, "SIGTERM");
		ctx.ui.notify(`SIGTERM sent to pid ${s.pid}`, "info");
		ctx.ui.setStatus("overnight", "");
	} catch (e: any) {
		ctx.ui.notify(`kill failed: ${e.message}`, "error");
	}
}

async function tail(rawArgs: string[], ctx: any): Promise<void> {
	const s = loadState();
	if (!s) {
		ctx.ui.notify("no overnight session", "warning");
		return;
	}
	const n = Math.max(1, Math.min(50, Number.parseInt(rawArgs[0] ?? "5", 10) || 5));
	const logPath = join(s.worktree, ".overnight", "NIGHT_LOG.md");
	const content = lastNLogEntries(logPath, n);
	ctx.ui.notify(`last ${n} entries from NIGHT_LOG.md:\n\n${content}`, "info");
}

async function showLogPath(ctx: any): Promise<void> {
	const s = loadState();
	if (!s) {
		ctx.ui.notify("no overnight session", "warning");
		return;
	}
	ctx.ui.notify(
		`night log: ${join(s.worktree, ".overnight", "NIGHT_LOG.md")}\nwrapper log: ${s.logFile}`,
		"info",
	);
}

// ----------------------------------------------------------------------------
// Clean: reset extension state and (optionally) remove worktrees / branches.
// ----------------------------------------------------------------------------

async function clean(rawArgs: string[], ctx: any): Promise<void> {
	const force = rawArgs.includes("--force");
	const withWorktrees =
		rawArgs.includes("--worktrees") || rawArgs.includes("--all");
	const all = rawArgs.includes("--all");
	const repoArg = rawArgs.find((a) => !a.startsWith("--"));

	const existing = loadState();

	// Determine target repo for worktree cleanup.
	let repo: string | null = null;
	if (repoArg) repo = resolve(repoArg);
	else if (existing?.repo) repo = existing.repo;
	else if (existsSync(join(ctx.cwd, ".git"))) repo = ctx.cwd;

	const summary: string[] = [];
	summary.push("about to clean:");

	if (existing) {
		const alive = isAlive(existing.pid);
		summary.push(
			`  • saved session state${alive ? " (⚠️  pid still alive)" : " (pid dead)"}`,
		);
		summary.push(`    ${STATE_FILE}`);
	} else {
		summary.push("  • no saved session state");
	}

	let worktreesToRemove: string[] = [];
	let branchesToRemove: string[] = [];
	if (withWorktrees && repo) {
		const parent = dirname(repo);
		const prefix = `${basename(repo)}-overnight-`;
		const fs = require("node:fs") as typeof import("node:fs");
		try {
			worktreesToRemove = fs
				.readdirSync(parent)
				.filter((name) => name.startsWith(prefix))
				.map((name) => join(parent, name))
				.filter((path) => existsSync(join(path, ".git")) || existsSync(join(path, ".overnight")));
		} catch {
			worktreesToRemove = [];
		}

		try {
			const { execSync } = require("node:child_process") as typeof import("node:child_process");
			const out = execSync(`git -C ${JSON.stringify(repo)} branch --list 'overnight/*'`, {
				encoding: "utf8",
			});
			branchesToRemove = out
				.split("\n")
				.map((l) => l.replace(/^[\* ]+/, "").trim())
				.filter((l) => l.startsWith("overnight/"));
		} catch {
			branchesToRemove = [];
		}

		if (worktreesToRemove.length > 0) {
			summary.push(`  • ${worktreesToRemove.length} worktree(s):`);
			for (const w of worktreesToRemove) summary.push(`      ${w}`);
		} else {
			summary.push("  • no worktrees found");
		}

		if (branchesToRemove.length > 0) {
			summary.push(`  • ${branchesToRemove.length} branch(es):`);
			for (const b of branchesToRemove) summary.push(`      ${b}`);
		} else {
			summary.push("  • no branches found");
		}
	} else if (withWorktrees) {
		ctx.ui.notify(
			"can't clean worktrees — no repo specified and no saved state to infer from.\nusage: /overnight clean --worktrees [repo-path]",
			"error",
		);
		return;
	} else {
		summary.push("  (worktrees + branches preserved — pass --worktrees or --all to also remove)");
	}

	if (existing && isAlive(existing.pid) && !force) {
		ctx.ui.notify(
			`overnight is still running (pid ${existing.pid}). stop it first with /overnight stop or /overnight kill, or pass --force.`,
			"warning",
		);
		return;
	}

	const ok = await ctx.ui.confirm(
		"clean overnight?",
		summary.join("\n") + "\n\nproceed?",
	);
	if (!ok) {
		ctx.ui.notify("cancelled", "info");
		return;
	}

	// 1. clear saved state
	if (existing) {
		saveState(null);
		ctx.ui.setStatus("overnight", "");
	}

	// 2. remove worktrees + branches if requested
	const removed: string[] = [];
	const failed: string[] = [];
	if (withWorktrees && repo) {
		const { execSync } = require("node:child_process") as typeof import("node:child_process");
		for (const w of worktreesToRemove) {
			try {
				execSync(`git -C ${JSON.stringify(repo)} worktree remove --force ${JSON.stringify(w)}`, {
					stdio: "pipe",
				});
				removed.push(`worktree: ${w}`);
			} catch (e: any) {
				failed.push(`worktree ${w}: ${e.message?.split("\n")[0] ?? e}`);
			}
		}
		for (const b of branchesToRemove) {
			try {
				execSync(`git -C ${JSON.stringify(repo)} branch -D ${JSON.stringify(b)}`, {
					stdio: "pipe",
				});
				removed.push(`branch: ${b}`);
			} catch (e: any) {
				failed.push(`branch ${b}: ${e.message?.split("\n")[0] ?? e}`);
			}
		}
	}

	const lines: string[] = [];
	lines.push("✨ cleaned");
	if (existing) lines.push(`  • cleared saved state at ${STATE_FILE}`);
	for (const r of removed) lines.push(`  • ${r}`);
	if (failed.length > 0) {
		lines.push("");
		lines.push("⚠️  some operations failed:");
		for (const f of failed) lines.push(`  • ${f}`);
	}
	ctx.ui.notify(lines.join("\n"), failed.length > 0 ? "warning" : "success");
}

// ----------------------------------------------------------------------------
// Shipped: show the morning handoff summary, or generate one retroactively if
// the playtester touched DONE without writing SHIPPED.md.
// ----------------------------------------------------------------------------

function listShippedFiles(worktree: string): string[] {
	const dir = join(worktree, ".overnight", "shipped");
	if (!existsSync(dir)) return [];
	try {
		const fs = require("node:fs") as typeof import("node:fs");
		return fs
			.readdirSync(dir)
			.filter((n) => n.endsWith(".md"))
			.sort()
			.map((n) => join(dir, n));
	} catch {
		return [];
	}
}

async function shipped(rawArgs: string[], pi: any, ctx: any): Promise<void> {
	const s = loadState();
	if (!s) {
		ctx.ui.notify("no overnight session recorded", "warning");
		return;
	}
	const legacyShipped = join(s.worktree, ".overnight", "SHIPPED.md");
	const hasLegacy = existsSync(legacyShipped);
	const shippedFiles = listShippedFiles(s.worktree);
	const regenerate = rawArgs.includes("--regenerate") || rawArgs.includes("--regen");

	if (shippedFiles.length === 0 && !hasLegacy && !regenerate) {
		ctx.ui.notify(
			"no features shipped yet. check progress with /overnight status.",
			"info",
		);
		return;
	}

	if (!regenerate) {
		const parts: string[] = [];
		parts.push(
			`🚀 ${shippedFiles.length + (hasLegacy ? 1 : 0)} shipped feature(s) this night`,
		);
		parts.push("─".repeat(60));
		if (hasLegacy) {
			parts.push("### legacy SHIPPED.md");
			parts.push(readFileSync(legacyShipped, "utf8").trimEnd());
			parts.push("");
			parts.push("─".repeat(60));
		}
		for (const f of shippedFiles) {
			parts.push(`### ${basename(f)}`);
			parts.push(readFileSync(f, "utf8").trimEnd());
			parts.push("");
			parts.push("─".repeat(60));
		}
		ctx.ui.notify(parts.join("\n"), "info");
		return;
	}

	// Either no SHIPPED.md, or user asked to regenerate.
	if (!ctx.isIdle()) {
		ctx.ui.notify(
			"agent is busy — wait for the current turn to finish, then run /overnight shipped --regenerate",
			"warning",
		);
		return;
	}

	const nightLog = join(s.worktree, ".overnight", "NIGHT_LOG.md");
	const featureFile = join(s.worktree, ".overnight", "FEATURE.md");
	const critiqueFile = join(s.worktree, ".overnight", "CRITIQUE.md");
	const shippedDir = join(s.worktree, ".overnight", "shipped");

	const kickoff = [
		`Generate the morning handoff summary for an overnight game-dev feature that just shipped, and write it as the next file in \`${shippedDir}/\`.`,
		``,
		`File naming: \`NN-feature-slug.md\` where NN is the next free integer (count existing files in \`${shippedDir}\` and add 1, padded to 2 digits) and slug is kebab-case from the feature name.`,
		``,
		`Read these files for context (they all exist in the worktree at \`${s.worktree}\`):`,
		`- \`${featureFile}\` — the current feature spec`,
		`- \`${nightLog}\` — the per-tick narrative`,
		`- \`${critiqueFile}\` — the playtester's notes (if it exists)`,
		`- existing files in \`${shippedDir}/\` (if any) so you don't duplicate a number or feature`,
		`- run \`git -C ${JSON.stringify(s.worktree)} diff main --stat\` and \`git -C ${JSON.stringify(s.worktree)} log main..HEAD --oneline\` to see what actually changed`,
		``,
		`Use these required sections, in this order:`,
		``,
		`# 🚀 Shipped: <feature name>`,
		``,
		`## What it does`,
		`(2–3 sentences from the player's POV)`,
		``,
		`## How to test`,
		`(numbered steps the human can follow in <5 minutes — commands, keys, what to look for)`,
		``,
		`## Files changed`,
		`(bullet list of paths, each with a one-line "why")`,
		``,
		`## Known issues`,
		`(carry-overs from CRITIQUE.md, with severity markers; "none" if there are none)`,
		``,
		`## What's next`,
		`(optional, 1–2 sentences of natural follow-up)`,
		``,
		`Write to disk via your write tool. Be concrete and concise — this is for a tired human at 7am. Under one page. After writing the file, report back with the path you wrote and a one-line confirmation.`,
	].join("\n");

	ctx.ui.notify(
		regenerate
			? "📝 regenerating SHIPPED.md from worktree state…"
			: "📝 no SHIPPED.md found — generating one from worktree state…",
		"info",
	);

	await pi.sendMessage(
		{
			customType: "overnight-shipped-regenerate",
			content: kickoff,
			display: false,
		},
		{
			triggerTurn: true,
			deliverAs: "steer",
		},
	);
}

// ----------------------------------------------------------------------------
// Author preferences: per-hat taste files appended to the agent's system prompt
// every tick. Updated incrementally as the human says what they liked/disliked.
// ----------------------------------------------------------------------------

function prefsFilePath(hat: Hat): string {
	return join(PREFS_DIR, `${hat}.md`);
}

function ensurePrefsFile(hat: Hat): string {
	if (!existsSync(PREFS_DIR)) mkdirSync(PREFS_DIR, { recursive: true });
	const path = prefsFilePath(hat);
	if (!existsSync(path)) {
		const stub =
			hat === "general"
				? `# Author preferences — general\n\n` +
				  `Bullets here apply to every hat (producer, designer, artist, coder, playtester).\n` +
				  `Add things you'd say at every game-jam meeting.\n\n`
				: `# Author preferences — ${hat}\n\n` +
				  `Bullets here apply only when the agent is wearing the ${hat} hat.\n\n`;
		writeFileSync(path, stub);
	}
	return path;
}

function parseHatArg(token: string | undefined): Hat | null {
	if (!token) return null;
	return (HATS as readonly string[]).includes(token) ? (token as Hat) : null;
}

async function prefer(args: string[], ctx: any): Promise<void> {
	if (args.length === 0) {
		ctx.ui.notify(
			`usage: /overnight prefer [hat] <text>\nhats: ${HATS.join(", ")}\nexamples:\n  /overnight prefer I love roguelikes with permadeath\n  /overnight prefer sprite-designer prefer 16-color palettes`,
			"warning",
		);
		return;
	}
	const maybeHat = parseHatArg(args[0]);
	const hat: Hat = maybeHat ?? "general";
	const textTokens = maybeHat ? args.slice(1) : args;
	if (textTokens.length === 0) {
		ctx.ui.notify("no preference text after the hat name", "warning");
		return;
	}
	const text = textTokens.join(" ").trim();
	const path = ensurePrefsFile(hat);
	const stamp = new Date().toISOString().slice(0, 10);
	appendFileSync(path, `- ${text}  _(added ${stamp})_\n`);
	ctx.ui.notify(
		`saved to ${hat}:\n  • ${text}\n\nfile: ${path}`,
		"success",
	);
}

async function prefs(args: string[], ctx: any): Promise<void> {
	// /overnight prefs               -> show all
	// /overnight prefs <hat>         -> show one
	// /overnight prefs edit [hat]    -> print path so the user can $EDITOR it
	if (args[0] === "edit") {
		const hatArg = args[1];
		const hat = hatArg ? parseHatArg(hatArg) : "general";
		if (!hat) {
			ctx.ui.notify(`unknown hat: ${hatArg}. options: ${HATS.join(", ")}`, "error");
			return;
		}
		const path = ensurePrefsFile(hat);
		ctx.ui.notify(
			`open this in your editor (pi can't host an editor inside its TUI):\n  ${path}`,
			"info",
		);
		return;
	}

	const targetArg = args[0];
	const targets: Hat[] = targetArg
		? (() => {
				const h = parseHatArg(targetArg);
				if (!h) {
					ctx.ui.notify(`unknown hat: ${targetArg}. options: ${HATS.join(", ")}`, "error");
					return [];
				}
				return [h];
			})()
		: [...HATS];

	if (targets.length === 0) return;

	const lines: string[] = [];
	for (const hat of targets) {
		const path = prefsFilePath(hat);
		lines.push(`### ${hat}`);
		if (existsSync(path)) {
			const body = readFileSync(path, "utf8").trim();
			lines.push(body || "(empty)");
		} else {
			lines.push("(no preferences yet — add with /overnight prefer)");
		}
		lines.push("");
	}
	ctx.ui.notify(lines.join("\n").trim(), "info");
}

// ----------------------------------------------------------------------------
// Onboarding interview: kicks off a conversational interview in the current pi
// session. The agent plays the interviewer, asks ~8-12 questions adapted to
// the user's answers, and writes findings to preference files as it goes.
// ----------------------------------------------------------------------------

function summarizeExistingPrefs(): { hasAny: boolean; summary: string } {
	if (!existsSync(PREFS_DIR)) return { hasAny: false, summary: "" };
	const lines: string[] = [];
	let hasAny = false;
	for (const hat of HATS) {
		const path = prefsFilePath(hat);
		if (!existsSync(path)) continue;
		const body = readFileSync(path, "utf8").trim();
		if (!body) continue;
		// detect non-trivial content (more than just the stub header)
		const meaningful = body.split("\n").filter((l) => l.startsWith("- "));
		if (meaningful.length === 0) continue;
		hasAny = true;
		lines.push(`### ${hat}`);
		lines.push(...meaningful);
		lines.push("");
	}
	return { hasAny, summary: lines.join("\n").trim() };
}

async function onboard(rawArgs: string[], pi: any, ctx: any): Promise<void> {
	const mode = rawArgs[0] === "fresh" ? "fresh" : "auto";
	const { hasAny, summary } = summarizeExistingPrefs();

	// Make sure all preference files exist and are writable so the agent can append to them.
	for (const hat of HATS) ensurePrefsFile(hat);

	const existingBlock =
		hasAny && mode !== "fresh"
			? `\n\n## Existing preferences (do NOT duplicate these; build on them)\n\n${summary}\n`
			: "";

	const hatList = HATS.map((h) => `\`${h}.md\``).join(", ");
	const dirHint = PREFS_DIR;

	const kickoff = [
		`I'm starting an onboarding interview for the overnight game-dev team.`,
		``,
		`**You are now the interviewer.** Your job is to learn the human author's tastes so the overnight team can build games tailored to them. The team has five hats: producer, game-designer, sprite-designer, coder, playtester. Plus a "general" bucket for cross-cutting taste.`,
		``,
		`## Rules for this interview`,
		``,
		`1. **Be conversational, not a form.** Ask one question at a time. Adapt follow-ups based on answers.`,
		`2. **Aim for ~8-12 questions total.** Don't grind through every hat — focus on what's most informative.`,
		`3. **Write findings to files incrementally**, after each substantive answer. Don't wait until the end.`,
		`4. **Each preference is a one-line bullet** in the appropriate file. Phrase as a directive ("prefer X", "avoid Y", "always Z"), not a quote of the user.`,
		`5. **End with a brief summary** of what you wrote and where, so the human can review.`,
		`6. **Stop when you have enough**, or when the human says they're done.`,
		``,
		`## Files to write to`,
		``,
		`Directory: \`${dirHint}\``,
		`Files (one per hat): ${hatList}`,
		``,
		`Each file is plain markdown. Append bullets to the end. Use the \`write\` or \`edit\` tool. Do not delete existing content unless the human asked to start over (mode = "${mode}").`,
		``,
		`## Topics to cover (pick the most useful, don't ask all of them)`,
		``,
		`**General taste** (\`general.md\`)`,
		`- What kinds of games do they love? Recent ones that made them say "wow"?`,
		`- What do they bounce off of? Common turn-offs?`,
		`- What's the vibe they want this team to have — polish, weird, cozy, brutal, etc.?`,
		``,
		`**Producer** (\`producer.md\`)`,
		`- How big should each feature be? (one-evening polish vs multi-day system)`,
		`- Do they prefer the team chase a known pattern or invent something weird?`,
		`- Risk appetite: ship rough-but-novel, or polish-but-conservative?`,
		``,
		`**Game designer** (\`game-designer.md\`)`,
		`- Permadeath / meta-progression / both / neither?`,
		`- Difficulty philosophy: tutorial-friendly, dark-souls, somewhere between?`,
		`- Mechanic preferences: turn-based, real-time, deck-builder, twitchy, etc.?`,
		`- A specific game they'd love this team to chase the feel of?`,
		``,
		`**Sprite / visual designer** (\`sprite-designer.md\`)`,
		`- Pixel art aesthetic preferences: 8-bit, 16-bit, modern hi-res, ASCII?`,
		`- Color palette taste: limited (e.g. 16-color), naturalistic, neon, monochrome?`,
		`- Animation: stiff/charming, smooth, none?`,
		``,
		`**Coder** (\`coder.md\`)`,
		`- Code style preferences they want respected (terse / verbose, comments, type strictness)?`,
		`- Tests: how much, how strict?`,
		`- Refactoring tolerance: leave-it-alone vs always-clean-as-you-go?`,
		``,
		`**Playtester** (\`playtester.md\`)`,
		`- How harsh should the playtester be? Pragmatic-ship-it or perfectionist?`,
		`- What kinds of issues are showstoppers vs nice-to-fix?`,
		``,
		`## Start now`,
		``,
		`Begin with a friendly one-line intro of what you're doing, then ask the first question. Don't dump the whole topic list on the human — ask organically.${existingBlock}`,
	].filter(Boolean).join("\n");

	if (!ctx.isIdle()) {
		ctx.ui.notify(
			"agent is busy — wait for the current turn to finish, then run /overnight onboard",
			"warning",
		);
		return;
	}

	ctx.ui.notify(
		hasAny
			? `🎤 starting onboarding interview (will build on existing prefs; pass "fresh" to ignore them)`
			: `🎤 starting onboarding interview — answers save to ${PREFS_DIR}`,
		"info",
	);

	// Deliver the kickoff prompt to the LLM without rendering it in the chat. The
	// agent receives the instructions silently and its first visible response is
	// the opening question.
	await pi.sendMessage(
		{
			customType: "overnight-interview-kickoff",
			content: kickoff,
			display: false,
		},
		{
			triggerTurn: true,
			deliverAs: "steer",
		},
	);
}
