/**
 * Claude Code-inspired Markdown blocks: language label + dim gutter, no fences.
 *
 * Pi's public Markdown transformer changes source text, not block layout. Keep
 * its parser (including nested blocks, streaming fences and Mermaid) intact and
 * replace only the code-token presentation. renderToken/theme are internal APIs:
 * tested with Wally 0.87.1-ws.8; re-run pi/tests/code-blocks.test.mjs after upgrades.
 * No installed files, conversation content, or exported Markdown are modified.
 */
import type { ExtensionAPI } from "@wealthsimple/pi-coding-agent";
import {
  Markdown,
  type MarkdownTheme,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@wealthsimple/pi-tui";

type Token = { type: string; text?: string; lang?: string };
type MarkdownInternals = {
  theme: MarkdownTheme;
  renderToken(token: Token, width: number, nextTokenType?: string, ...rest: unknown[]): string[];
};

function renderCodeBlock(token: Token, width: number, theme: MarkdownTheme): string[] {
  const language = token.lang?.trim().split(/\s+/, 1)[0];
  const code = token.text ?? "";
  const highlighted = theme.highlightCode
    ? theme.highlightCode(code, language)
    : code.split("\n").map((line) => theme.codeBlock(line));

  // Drop decoration in extremely narrow panes. Reserve at least two columns
  // for code when showing a gutter, so wide characters can still fit.
  const gutter = width >= 5
    ? `│${truncateToWidth(theme.codeBlockIndent ?? "  ", width - 3, "")}`
    : "";
  const codeWidth = Math.max(1, width - visibleWidth(gutter));
  const lines: string[] = [];
  if (gutter) {
    lines.push(theme.codeBlockBorder(truncateToWidth(`╭─ ${language || "code"}`, width, "…")));
  }
  for (const line of highlighted) {
    for (const wrapped of wrapTextWithAnsi(line, codeWidth)) {
      // A two-column glyph cannot fit a one-column terminal. The native wrap
      // helper can return it over-width; clip that pathological case safely.
      lines.push(theme.codeBlockBorder(gutter) + truncateToWidth(wrapped, codeWidth, "…"));
    }
  }
  if (gutter) lines.push(theme.codeBlockBorder("╰─"));
  return lines;
}

export default function codeBlocks(pi: ExtensionAPI) {
  let restore: (() => void) | undefined;

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui" || restore) return;
    const prototype = Markdown.prototype as unknown as MarkdownInternals;
    const original = prototype.renderToken;
    if (typeof original !== "function") {
      ctx.ui.notify("Code-block styling is incompatible with this Wally version; using the default renderer.", "warning");
      return;
    }

    let active = true;
    const renderToken: MarkdownInternals["renderToken"] = function (this: MarkdownInternals, token, width, nextTokenType, ...rest) {
      if (!active || token.type !== "code") {
        return original.call(this, token, width, nextTokenType, ...rest);
      }
      const lines = renderCodeBlock(token, width, this.theme);
      if (nextTokenType && nextTokenType !== "space") lines.push("");
      return lines;
    };
    prototype.renderToken = renderToken;
    restore = () => {
      active = false;
      // Don't overwrite another extension's wrapper if it was installed later.
      if (prototype.renderToken === renderToken) prototype.renderToken = original;
    };
  });

  pi.on("session_shutdown", () => {
    restore?.();
    restore = undefined;
  });
}
