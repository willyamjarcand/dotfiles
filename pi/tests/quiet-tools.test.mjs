import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { loadExtension, plain, sdk, themes, tui } from "./wally-runtime.mjs";

let extension;
beforeEach(async () => { extension = await loadExtension("quiet-tools"); });
afterEach(async () => { await extension.stop(); themes.setTheme("dark", false); });

function tool(name, args = {}) {
  return new sdk.ToolExecutionComponent(name, "test-call", args, { showImages: false }, undefined,
    { requestRender() {} }, process.cwd());
}
function finish(component, text = "tool output", isError = false, isPartial = false) {
  component.updateResult({ content: [{ type: "text", text }], isError }, isPartial);
}

test("routine tools occupy no transcript rows before, during, or after success", async () => {
  await extension.start();
  for (const name of ["read", "bash", "powershell", "edit", "write", "grep", "find", "ls"]) {
    const component = tool(name, { path: "/tmp/file.ts", command: "printf hello" });
    assert.deepEqual(component.render(80), []);
    component.markExecutionStarted();
    finish(component, "streaming output", false, true);
    assert.deepEqual(component.render(80), []);
    finish(component);
    assert.deepEqual(component.render(80), []);
  }
});

test("skill reads show only a compact skill name, never the skill's contents", async () => {
  await extension.start();
  const component = tool("read", { path: "/home/user/.claude/skills/study-mode/SKILL.md" });
  assert.deepEqual(plain(component.render(80)), ["", " Skill · study-mode"]);
  finish(component, "very long skill instructions");
  assert.deepEqual(plain(component.render(80)), ["", " Skill · study-mode"]);
  assert.ok(component.render(8).every((line) => tui.visibleWidth(line) <= 8));
  component.setExpanded(true);
  assert.match(plain(component.render(80)).join("\n"), /very long skill instructions/);
});

test("plugin, MCP and subagent tools retain their native rendering", async () => {
  const components = ["mcplocker_invoke_tool", "spawn_agent", "custom-plugin"].map((name) => tool(name));
  for (const component of components) finish(component, "plugin result");
  const original = components.map((component) => component.render(80));
  await extension.start();
  assert.deepEqual(components.map((component) => component.render(80)), original);
});

test("failures stay visible even for routine tools and skill reads", async () => {
  await extension.start();
  for (const [name, args] of [["bash", {}], ["read", { path: "/skills/example/SKILL.md" }]]) {
    const component = tool(name, args);
    finish(component, "Permission denied", true);
    assert.match(plain(component.render(80)).join("\n"), /Permission denied/);
  }
});

test("the native expand toggle reveals and hides both pending and finished tools", async () => {
  const component = tool("bash", { command: "printf hello" });
  const nativePending = component.render(80);
  await extension.start();
  component.setExpanded(true);
  assert.deepEqual(component.render(80), nativePending);
  component.setExpanded(false);
  assert.deepEqual(component.render(80), []);
  finish(component, "hello");
  component.setExpanded(true);
  assert.match(plain(component.render(80)).join("\n"), /hello/);
  component.setExpanded(false);
  assert.deepEqual(component.render(80), []);
});

test("repeated startup and reload do not stack wrappers or lose native rendering", async () => {
  const component = tool("read", { path: "/tmp/example.ts" });
  const original = component.render(80);
  await extension.start();
  await extension.start();
  assert.deepEqual(component.render(80), []);
  await extension.stop();
  await extension.stop();
  assert.deepEqual(component.render(80), original);
  await extension.start();
  assert.deepEqual(component.render(80), []);
});

test("non-interactive modes are unchanged", async () => {
  const component = tool("bash", { command: "printf hello" });
  const original = component.render(80);
  for (const mode of ["rpc", "json", "print"]) {
    await extension.start(mode);
    assert.deepEqual(component.render(80), original);
  }
});
