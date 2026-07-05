#!/usr/bin/env node

import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const sourceScript = join(pluginRoot, "statusline.mjs");
const claudeDir = join(homedir(), ".claude");
const targetScript = join(claudeDir, "statusline-behagoras.mjs");
const settingsPath = join(claudeDir, "settings.json");

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function readSettings() {
  if (!existsSync(settingsPath)) return {};

  try {
    return JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch (error) {
    throw new Error(`Could not parse ${settingsPath}: ${error.message}`);
  }
}

function backupSettings() {
  if (!existsSync(settingsPath)) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${settingsPath}.bak-statusline-${stamp}`;
  copyFileSync(settingsPath, backupPath);
  return backupPath;
}

mkdirSync(claudeDir, { recursive: true });
copyFileSync(sourceScript, targetScript);
chmodSync(targetScript, 0o755);

const settings = readSettings();
const command = `node ${shellQuote(targetScript)}`;
const nextStatusLine = {
  type: "command",
  command,
  padding: 0
};

const previous = JSON.stringify(settings.statusLine ?? null);
const next = JSON.stringify(nextStatusLine);
const backupPath = previous === next ? null : backupSettings();

settings.statusLine = nextStatusLine;
writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

console.log(`Installed renderer: ${targetScript}`);
console.log(`Updated settings: ${settingsPath}`);
if (backupPath) {
  console.log(`Backup: ${backupPath}`);
}
console.log(`Command: ${command}`);
