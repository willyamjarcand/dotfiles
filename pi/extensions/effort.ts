// /effort — set the agent's thinking level, mirroring the Claude Code slash command.
//
// Usage:
//   /effort                  — show current level
//   /effort low              — set to "low"
//   /effort high             — set to "high"
//   /effort off|minimal|low|medium|high|xhigh
//
// pi's native concept is "thinking level". This is just a thin alias so muscle memory
// from Claude Code keeps working. The same control is also available via /settings.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

const LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
type Level = (typeof LEVELS)[number];

function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("effort", {
    description: "Set thinking level (off|minimal|low|medium|high|xhigh)",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const items = LEVELS.map((l) => ({ value: l, label: l }));
      const filtered = items.filter((i) => i.value.startsWith(prefix.trim()));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const arg = args.trim().toLowerCase();
      if (!arg) {
        ctx.ui.notify(`thinking level: ${pi.getThinkingLevel()}`, "info");
        return;
      }
      if (!isLevel(arg)) {
        ctx.ui.notify(
          `unknown level "${arg}". Use one of: ${LEVELS.join(", ")}`,
          "error",
        );
        return;
      }
      pi.setThinkingLevel(arg);
      ctx.ui.notify(`thinking level → ${arg}`, "success");
    },
  });
}
