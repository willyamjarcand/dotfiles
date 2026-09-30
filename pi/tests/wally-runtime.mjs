// Exercise the installed Wally renderer/loader without a model or a live session.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";

const executable = realpathSync(execFileSync("which", ["wally"], { encoding: "utf8" }).trim());
const require = createRequire(executable);
const root = dirname(require.resolve("@wealthsimple/pi-coding-agent/package.json"));
export const tui = await import(pathToFileURL(require.resolve("@wealthsimple/pi-tui")));
export const themes = await import(pathToFileURL(join(root, "dist/modes/interactive/theme/theme.js")));
const components = await import(pathToFileURL(join(root, "dist/modes/interactive/components/tool-execution.js")));
// The published unbundled SDK root references dev-only extension packages.
// Import its real renderer/theme modules directly, not a replacement renderer.
export const sdk = { ...themes, ...components };
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, {
  moduleCache: false,
  tryNative: false,
  virtualModules: { "@wealthsimple/pi-tui": tui, "@wealthsimple/pi-coding-agent": sdk },
});
sdk.initTheme("dark", false);

export async function loadExtension(name) {
  const path = fileURLToPath(new URL(`../extensions/${name}.ts`, import.meta.url));
  const factory = await jiti.import(path, { default: true });
  assert.equal(typeof factory, "function");
  const handlers = new Map();
  // Only the extension host boundary is simulated; all rendering is native.
  await factory({ on(type, handler) { handlers.set(type, [...(handlers.get(type) ?? []), handler]); } });
  const notifications = [];
  async function emit(type, mode = "tui") {
    const ctx = {
      mode,
      ui: {
        get theme() { return themes.theme; },
        notify: (message) => notifications.push(message),
      },
    };
    for (const handler of handlers.get(type) ?? []) await handler({ type }, ctx);
  }
  return {
    notifications,
    start: (mode) => emit("session_start", mode),
    stop: () => emit("session_shutdown"),
  };
}

export function plain(lines) {
  return lines.map((line) => stripVTControlCharacters(line).trimEnd());
}
