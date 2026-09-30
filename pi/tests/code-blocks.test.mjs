import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { loadExtension, plain, sdk, themes, tui } from "./wally-runtime.mjs";

let extension;
beforeEach(async () => { extension = await loadExtension("code-blocks"); });
afterEach(async () => { await extension.stop(); themes.setTheme("dark", false); });
const markdown = (source, theme = sdk.getMarkdownTheme()) => new tui.Markdown(source, 0, 0, theme);

test("TSX renders a labelled gutter with native syntax colors, without fence markers", async () => {
  await extension.start();
  const code = 'const Greeting = () => <h1>Hello</h1>;';
  const lines = markdown(`\`\`\`tsx\n${code}\n\`\`\``).render(80);
  assert.deepEqual(plain(lines), ["╭─ tsx", `│  ${code}`, "╰─"]);
  assert.ok(lines[1].includes(sdk.highlightCode(code, "tsx")[0]));
  assert.ok(new Set(lines[1].match(/\x1b\[[0-9;]*m/g)).size > 2, "real syntax colors survive");
});

test("untagged and unsupported languages remain literal code", async () => {
  await extension.start();
  for (const lang of ["", "not-a-language"]) {
    assert.deepEqual(plain(markdown(`\`\`\`${lang}\n# **literal** <tag>\n\`\`\``).render(80)), [
      `╭─ ${lang || "code"}`, "│  # **literal** <tag>", "╰─",
    ]);
  }
});

test("language metadata does not disable highlighting and fallback themes work", async () => {
  await extension.start();
  const theme = sdk.getMarkdownTheme();
  delete theme.highlightCode;
  const lines = markdown('~~~tsx title="demo"\n  <div />\n~~~', theme).render(40);
  assert.deepEqual(plain(lines), ["╭─ tsx", "│    <div />", "╰─"]);
});

test("keeps blank lines, indentation, literal backticks and following prose", async () => {
  await extension.start();
  assert.deepEqual(plain(markdown('````text\n  first\n\n```\n  last\n````\nFollowing prose').render(40)), [
    "╭─ text", "│    first", "│", "│  ```", "│    last", "╰─", "", "Following prose",
  ]);
  assert.deepEqual(plain(markdown("```\n```\n").render(40)), ["╭─ code", "│", "╰─"]);
});

test("uses the native parser for nested blocks and indented code", async () => {
  await extension.start();
  const list = plain(markdown("- Example:\n\n  ```js\n  let value = 1;\n  ```").render(40));
  assert.ok(list.includes("  ╭─ js"));
  assert.ok(list.includes("  │  let value = 1;"));
  const quote = plain(markdown("> ```js\n> let value = 1;\n> ```").render(40));
  assert.deepEqual(quote, ["│ ╭─ js", "│ │  let value = 1;", "│ ╰─"]);
  assert.deepEqual(plain(markdown("    indented code").render(40)), ["╭─ code", "│  indented code", "╰─"]);
});

test("streaming closing fences never leak and setText invalidates the cache", async () => {
  await extension.start();
  const component = markdown("");
  for (const suffix of ["", "`", "``", "```", "```\n"]) {
    component.setText(`\`\`\`js\nconst n = 1;\n${suffix}`);
    const lines = plain(component.render(40));
    assert.ok(lines.includes("│  const n = 1;"));
    assert.ok(!lines.join("\n").includes("`"));
  }
});

test("wraps with gutters within the viewport, including Unicode and tiny panes", async () => {
  await extension.start();
  const component = markdown('```tsx\nconst greeting = "世界 👩‍💻 é"; // ' + "x".repeat(120) + '\n```');
  for (const width of [1, 2, 4, 5, 8, 20, 80]) {
    const lines = component.render(width);
    assert.ok(lines.every((line) => tui.visibleWidth(line) <= width), `width ${width}`);
    if (width >= 5) assert.ok(plain(lines).slice(1, -1).every((line) => line.startsWith("│")));
  }
});

test("leaves non-code Markdown unchanged and uses current colors after invalidation", async () => {
  const source = "# Heading\n\n**bold** and `inline`\n\n- item\n\n> quote";
  const before = markdown(source).render(60);
  await extension.start();
  assert.deepEqual(markdown(source).render(60), before);
  const component = markdown("```js\nconst n = 1;\n```");
  const dark = component.render(40);
  themes.setTheme("light", false);
  component.invalidate();
  const light = component.render(40);
  assert.deepEqual(plain(light), plain(dark));
  assert.notDeepEqual(light, dark);
});

test("start is idempotent, shutdown restores native output, reload can reapply", async () => {
  const source = "```js\nhello\n```";
  const original = markdown(source).render(40);
  await extension.start();
  await extension.start();
  assert.equal(plain(markdown(source).render(40))[0], "╭─ js");
  await extension.stop();
  await extension.stop();
  assert.deepEqual(markdown(source).render(40), original);
  await extension.start();
  assert.equal(plain(markdown(source).render(40))[0], "╭─ js");
});

test("does not alter rendering in non-TUI modes", async () => {
  const source = "```js\nhello\n```";
  const original = markdown(source).render(40);
  for (const mode of ["rpc", "json", "print"]) {
    await extension.start(mode);
    assert.deepEqual(markdown(source).render(40), original);
  }
});
