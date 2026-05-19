/**
 * DOOM Overlay Demo - Play DOOM as an overlay
 *
 * Usage: pi --extension ./examples/extensions/doom-overlay
 *
 * Commands:
 *   /doom-overlay - Play DOOM in an overlay (Q to pause/exit)
 *
 * This demonstrates that overlays can handle real-time game rendering at 35 FPS.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DoomOverlayComponent } from "./doom-component.js";
import { DoomEngine } from "./doom-engine.js";
import { ensureWadFile } from "./wad-finder.js";

// Persistent engine instance - survives between invocations
let activeEngine: DoomEngine | null = null;
let activeWadPath: string | null = null;

// Shared handler so /doom and /doom-overlay both work.
async function doomHandler(args: string | undefined, ctx: any) {
	if (!ctx.hasUI) {
		ctx.ui.notify("DOOM requires interactive mode", "error");
		return;
	}

	ctx.ui.notify("Loading DOOM...", "info");
	const wad = args?.trim() ? args.trim() : await ensureWadFile();

	if (!wad) {
		ctx.ui.notify("Failed to download DOOM WAD file. Check your internet connection.", "error");
		return;
	}

	try {
		let isResume = false;
		if (activeEngine && activeWadPath === wad) {
			ctx.ui.notify("Resuming DOOM...", "info");
			isResume = true;
		} else {
			ctx.ui.notify(`Loading DOOM from ${wad}...`, "info");
			activeEngine = new DoomEngine(wad);
			await activeEngine.init();
			activeWadPath = wad;
		}

		await ctx.ui.custom(
			(tui: any, _theme: any, _keybindings: any, done: any) => {
				return new DoomOverlayComponent(tui, activeEngine!, () => done(undefined), isResume);
			},
			{
				overlay: true,
				overlayOptions: {
					width: "75%",
					maxHeight: "95%",
					anchor: "center",
					margin: { top: 1 },
				},
			},
		);
	} catch (error) {
		ctx.ui.notify(`Failed to load DOOM: ${error}`, "error");
		activeEngine = null;
		activeWadPath = null;
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("doom", {
		description: "Play DOOM as an overlay. Q to pause and exit.",
		handler: doomHandler,
	});
	pi.registerCommand("doom-overlay", {
		description: "Alias for /doom.",
		handler: doomHandler,
	});
}
