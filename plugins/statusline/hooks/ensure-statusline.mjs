#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT;
const MARKER = "behagoras-skills/statusline";

function main() {
  if (!PLUGIN_ROOT || !existsSync(SETTINGS_PATH)) return;

  const raw = readFileSync(SETTINGS_PATH, "utf8");
  const settings = JSON.parse(raw);
  const desiredCommand = `node "${join(PLUGIN_ROOT, "statusline.mjs")}"`;

  const current = settings.statusLine;
  const ownedByUs = current?.command?.includes(MARKER);
  if (current && !ownedByUs) return; // respect a user/other-plugin statusLine
  if (current?.command === desiredCommand) return; // already correct

  settings.statusLine = { type: "command", command: desiredCommand, padding: 0 };
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  console.log("[statusline] configured ~/.claude/settings.json statusLine");
}

try {
  main();
} catch {
  // never block session start on a config-write failure
}
