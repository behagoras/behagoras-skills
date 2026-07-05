import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { test } from "node:test";

import {
  applyPresetToFile,
  applyPresetToText,
  printRecommendedToml,
  revertFromBackup,
  validatePreset
} from "../scripts/apply-codex-statusline.mjs";

test("config without [tui] adds the section", () => {
  const input = 'model = "gpt-5"\n';
  const output = applyPresetToText(input);

  assert.match(output, /model = "gpt-5"\n\n\[tui\]\nstatus_line = \[/);
  assert.match(output, /"model-with-reasoning",/);
  assert.match(output, /status_line_use_colors = true/);
});

test("config with [tui] replaces only owned keys", () => {
  const input = [
    'model = "gpt-5"',
    "",
    "[tui]",
    "show_tooltips = false",
    'status_line = ["model"]',
    "status_line_use_colors = false",
    'theme = "dark"',
    "",
    "[mcp_servers.docs]",
    'command = "docs-mcp"',
    ""
  ].join("\n");

  const output = applyPresetToText(input);

  assert.match(output, /\[tui\]\nstatus_line = \[/);
  assert.match(output, /status_line_use_colors = true/);
  assert.match(output, /show_tooltips = false/);
  assert.match(output, /theme = "dark"/);
  assert.match(output, /\[mcp_servers\.docs\]\ncommand = "docs-mcp"/);
  assert.doesNotMatch(output, /status_line = \["model"\]/);
  assert.doesNotMatch(output, /status_line_use_colors = false/);
});

test("config with multiline status_line replaces the whole array", () => {
  const input = [
    "[tui]",
    "status_line = [",
    '  "model",',
    '  "git-branch",',
    "]",
    "show_tooltips = true",
    ""
  ].join("\n");

  const output = applyPresetToText(input);

  assert.equal((output.match(/status_line = \[/g) || []).length, 1);
  assert.doesNotMatch(output, /  "model",\n  "git-branch",/);
  assert.match(output, /show_tooltips = true/);
});

test("idempotence: second execution does not change content", () => {
  const once = applyPresetToText('model = "gpt-5"\n');
  const twice = applyPresetToText(once);

  assert.equal(twice, once);
});

test("--dry-run equivalent does not write", async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), "codex-statusline-"));
  try {
    const configPath = join(tempDir, "config.toml");
    await writeFile(configPath, 'model = "gpt-5"\n', "utf8");

    const result = await applyPresetToFile(configPath, { dryRun: true });
    const after = await readFile(configPath, "utf8");

    assert.equal(result.changed, true);
    assert.equal(result.backupPath, null);
    assert.equal(after, 'model = "gpt-5"\n');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("revert restores a timestamped backup", async () => {
  const tempDir = await mkdtemp(join(os.tmpdir(), "codex-statusline-"));
  try {
    const configPath = join(tempDir, "config.toml");
    const original = 'model = "gpt-5"\n';
    await writeFile(configPath, original, "utf8");

    const result = await applyPresetToFile(configPath);
    assert.ok(result.backupPath);
    assert.ok(existsSync(result.backupPath));

    await revertFromBackup(result.backupPath);
    const restored = await readFile(configPath, "utf8");

    assert.equal(restored, original);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("invalid IDs in the preset fail validation", () => {
  assert.throws(
    () => validatePreset(["model-with-reasoning", "not-a-codex-item"]),
    /Unknown Codex status-line item IDs: not-a-codex-item/
  );
});

test("print helper emits the documented TOML block", () => {
  assert.equal(printRecommendedToml().startsWith("[tui]\nstatus_line = ["), true);
  assert.match(printRecommendedToml(), /status_line_use_colors = true/);
});
