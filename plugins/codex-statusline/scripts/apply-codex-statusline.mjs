#!/usr/bin/env node
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = dirname(__dirname);
const itemsPath = join(pluginRoot, "statusline-items.json");
const TARGET_KEYS = new Set(["status_line", "status_line_use_colors"]);

const items = JSON.parse(await readFile(itemsPath, "utf8"));

export const SUPPORTED_STATUS_LINE_IDS = Object.freeze([...items.supportedIds]);
export const RECOMMENDED_STATUS_LINE = Object.freeze([...items.recommendedPreset]);

export function defaultConfigPath(env = process.env) {
  const codexHome = env.CODEX_HOME || join(os.homedir(), ".codex");
  return join(codexHome, "config.toml");
}

export function printRecommendedToml(preset = RECOMMENDED_STATUS_LINE) {
  return ["[tui]", ...renderTuiPresetLines(preset)].join("\n");
}

export function validatePreset(
  preset = RECOMMENDED_STATUS_LINE,
  supportedIds = SUPPORTED_STATUS_LINE_IDS
) {
  const supported = new Set(supportedIds);
  const unknown = preset.filter((id) => !supported.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown Codex status-line item IDs: ${unknown.join(", ")}`);
  }
}

export function applyPresetToText(text, options = {}) {
  const preset = options.preset || RECOMMENDED_STATUS_LINE;
  validatePreset(preset, options.supportedIds || SUPPORTED_STATUS_LINE_IDS);

  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = splitLines(text);
  const tuiRange = findTuiSection(lines);
  const presetLines = renderTuiPresetLines(preset);

  let nextLines;
  if (!tuiRange) {
    nextLines = [...lines];
    if (nextLines.length > 0 && nextLines.at(-1) !== "") {
      nextLines.push("");
    }
    nextLines.push("[tui]", ...presetLines);
  } else {
    const before = lines.slice(0, tuiRange.start + 1);
    const section = lines.slice(tuiRange.start + 1, tuiRange.end);
    const after = lines.slice(tuiRange.end);
    const cleaned = removeTargetAssignments(section);
    nextLines = [...before, ...presetLines];
    if (cleaned.length > 0) {
      if (cleaned[0] !== "") {
        nextLines.push("");
      }
      nextLines.push(...cleaned);
    }
    nextLines.push(...after);
  }

  return `${nextLines.join(newline)}${newline}`;
}

export async function applyPresetToFile(configPath, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const existed = existsSync(configPath);
  const original = existed ? await readFile(configPath, "utf8") : "";
  const next = applyPresetToText(original, options);
  const changed = original !== next;

  if (dryRun || !changed) {
    return { changed, dryRun, configPath, backupPath: null, content: next };
  }

  await mkdir(dirname(configPath), { recursive: true });
  let backupPath = null;
  if (existed) {
    backupPath = await createBackup(configPath);
  }
  await writeFile(configPath, next, "utf8");
  return { changed, dryRun, configPath, backupPath, content: next };
}

export async function revertFromBackup(backupPath, configPath) {
  const targetPath = configPath || configPathFromBackup(backupPath);
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(backupPath, targetPath);
  return { backupPath, configPath: targetPath };
}

function splitLines(text) {
  if (text.length === 0) {
    return [];
  }
  return text.replace(/\r?\n$/, "").split(/\r?\n/);
}

function findTuiSection(lines) {
  const start = lines.findIndex((line) => /^\s*\[tui\]\s*(?:#.*)?$/.test(line));
  if (start === -1) {
    return null;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[.*\]\s*(?:#.*)?$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return { start, end };
}

function removeTargetAssignments(lines) {
  const cleaned = [];
  for (let index = 0; index < lines.length; ) {
    const key = assignmentKey(lines[index]);
    if (!TARGET_KEYS.has(key)) {
      cleaned.push(lines[index]);
      index += 1;
      continue;
    }

    let depth = bracketDelta(lines[index]);
    index += 1;
    while (key === "status_line" && depth > 0 && index < lines.length) {
      depth += bracketDelta(lines[index]);
      index += 1;
    }
  }

  while (cleaned.length > 0 && cleaned[0] === "") {
    cleaned.shift();
  }
  return cleaned;
}

function assignmentKey(line) {
  const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=/);
  return match ? match[1] : null;
}

function bracketDelta(line) {
  let delta = 0;
  for (const char of line) {
    if (char === "[") {
      delta += 1;
    } else if (char === "]") {
      delta -= 1;
    }
  }
  return delta;
}

function renderTuiPresetLines(preset) {
  return [
    "status_line = [",
    ...preset.map((id, index) => {
      const comma = index === preset.length - 1 ? "" : ",";
      return `  "${id}"${comma}`;
    }),
    "]",
    "status_line_use_colors = true"
  ];
}

async function createBackup(configPath) {
  let backupPath = `${configPath}.bak-${timestamp()}`;
  let suffix = 1;
  while (existsSync(backupPath)) {
    backupPath = `${configPath}.bak-${timestamp()}-${suffix}`;
    suffix += 1;
  }
  await copyFile(configPath, backupPath);
  return backupPath;
}

function timestamp(date = new Date()) {
  const parts = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  ].map((part) => String(part).padStart(2, "0"));
  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
}

function configPathFromBackup(backupPath) {
  const match = backupPath.match(/^(.*)\.bak-\d{8}-\d{6}(?:-\d+)?$/);
  if (!match) {
    throw new Error(
      "Could not derive config path from backup name; pass --config <path> with --revert."
    );
  }
  return match[1];
}

function parseArgs(argv) {
  const args = {
    configPath: null,
    configPathExplicit: false,
    dryRun: false,
    print: false,
    revert: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--config") {
      args.configPath = requiredValue(argv, ++index, "--config");
      args.configPathExplicit = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--print") {
      args.print = true;
    } else if (arg === "--revert") {
      args.revert = requiredValue(argv, ++index, "--revert");
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function usage() {
  return `Usage: apply-codex-statusline.mjs [--config <path>] [--dry-run] [--print] [--revert <backup-path>]

Options:
  --config <path>       Config file to edit. Defaults to $CODEX_HOME/config.toml or ~/.codex/config.toml.
  --dry-run             Validate and compute the change without writing files.
  --print               Print the recommended TOML block and exit.
  --revert <backup>     Restore a timestamped backup. Use --config to choose the restore target.
  --help                Show this help.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args.print) {
    console.log(printRecommendedToml());
    return;
  }
  if (args.revert) {
    const result = await revertFromBackup(
      args.revert,
      args.configPathExplicit ? args.configPath : undefined
    );
    console.log(`Restored ${result.configPath} from ${result.backupPath}`);
    return;
  }

  const configPath = args.configPath || defaultConfigPath();
  const result = await applyPresetToFile(configPath, { dryRun: args.dryRun });
  if (args.dryRun) {
    console.log(result.changed ? `Would update ${result.configPath}` : `No changes needed for ${result.configPath}`);
    return;
  }
  if (!result.changed) {
    console.log(`No changes needed for ${result.configPath}`);
    return;
  }
  if (result.backupPath) {
    console.log(`Backup written to ${result.backupPath}`);
  }
  console.log(`Updated ${result.configPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
