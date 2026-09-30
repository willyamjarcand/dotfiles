/**
 * Hide routine built-in tool rows, not tool execution or session history.
 * Skill reads get a compact label; plugin/MCP tools and failures stay visible.
 * Ctrl+O (app.tools.expand) reveals the original rows for debugging.
 *
 * ToolExecutionComponent is exported, but its display state is internal.
 * Tested with Wally 0.87.1-ws.8; re-run pi/tests/quiet-tools.test.mjs on upgrades.
 */
import { type ExtensionAPI, ToolExecutionComponent } from "@wealthsimple/pi-coding-agent";
import { truncateToWidth } from "@wealthsimple/pi-tui";

const ROUTINE_TOOLS = new Set(["read", "bash", "powershell", "edit", "write", "grep", "find", "ls"]);
type ToolDisplayState = {
  toolName?: string;
  args?: { path?: string };
  expanded?: boolean;
  result?: { isError?: boolean };
};

export default function quietTools(pi: ExtensionAPI) {
  let restore: (() => void) | undefined;

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui" || restore) return;
    const prototype = ToolExecutionComponent.prototype;
    const original = prototype.render;
    let active = true;
    const render: typeof original = function (this: ToolExecutionComponent, width) {
      const state = this as unknown as ToolDisplayState;
      // Unknown state fails open after an upgrade. Expanded rows always retain
      // the native UI, including diffs, image previews and error details.
      if (!active || state.expanded !== false || state.result?.isError || !ROUTINE_TOOLS.has(state.toolName ?? "")) {
        return original.call(this, width);
      }
      const skill = state.toolName === "read" && typeof state.args?.path === "string"
        ? /(?:^|[/\\])([^/\\]+)[/\\]SKILL\.md$/i.exec(state.args.path)?.[1]
        : undefined;
      if (skill) {
        const label = ctx.ui.theme.fg("accent", "Skill") + ctx.ui.theme.fg("muted", ` · ${skill}`);
        return ["", truncateToWidth(` ${label}`, width, "…")];
      }
      return [];
    };
    prototype.render = render;
    restore = () => {
      active = false;
      if (prototype.render === render) prototype.render = original;
    };
  });

  pi.on("session_shutdown", () => {
    restore?.();
    restore = undefined;
  });
}
