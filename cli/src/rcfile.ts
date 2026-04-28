import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Read/merge/write `.transcriptsrc`-style files generically.
 *
 * Format (must match `transcribe.sh`'s strict parser):
 *   - One `key=value` pair per non-comment line.
 *   - Comments start with `#`.
 *   - No quoting, no expansions, no shell.
 *
 * Atomic write: temp file + rename, so a crash mid-write never leaves a
 * half-written rc.
 */

export type RcValues = Record<string, string>;

export interface ReadRcResult {
  exists: boolean;
  /** Raw lines as read; preserved on write so user comments survive. */
  lines: string[];
  /** Parsed key/value snapshot. */
  values: RcValues;
}

const KV_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

export async function readRc(filePath: string): Promise<ReadRcResult> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, lines: [], values: {} };
    }
    throw err;
  }
  const lines = raw.split(/\r?\n/);
  const values: RcValues = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(KV_RE);
    if (!m) continue;
    const [, k, v] = m;
    values[k!] = (v ?? '').trim();
  }
  return { exists: true, lines, values };
}

export interface WriteRcOptions {
  /** Header comment block prepended ONLY when creating a fresh file. */
  header?: string;
  /** When true, replace the file even if it exists. Default false → merge. */
  overwrite?: boolean;
}

/**
 * Merge `updates` into the rc file at `filePath`.
 *
 * - If the file does not exist: write a fresh file with optional `header` and
 *   then the keys from `updates` in declaration order.
 * - If the file exists: rewrite each line in place, replacing values for keys
 *   present in `updates`; append any keys from `updates` that didn't exist
 *   yet. Comments and unrelated lines are preserved.
 *
 * The atomic-write contract is satisfied via `${filePath}.tmp` + rename.
 */
export async function writeRc(
  filePath: string,
  updates: RcValues,
  opts: WriteRcOptions = {}
): Promise<{ created: boolean; merged: boolean }> {
  const existing = await readRc(filePath);

  if (!existing.exists || opts.overwrite) {
    const headerLines = opts.header ? [opts.header.replace(/\n+$/, '')] : [];
    const updateLines = Object.entries(updates).map(([k, v]) => `${k}=${v}`);
    const out = [...headerLines, ...updateLines, ''].join('\n');
    await atomicWrite(filePath, out);
    return { created: true, merged: false };
  }

  // Merge: walk lines, replace KV lines whose key is in updates; remember which keys handled.
  const seen = new Set<string>();
  const newLines: string[] = [];
  for (const line of existing.lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      newLines.push(line);
      continue;
    }
    const m = trimmed.match(KV_RE);
    if (!m) {
      newLines.push(line);
      continue;
    }
    const key = m[1]!;
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      newLines.push(`${key}=${updates[key]}`);
      seen.add(key);
    } else {
      newLines.push(line);
    }
  }
  // Append any updates not present yet.
  const appended: string[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) appended.push(`${k}=${v}`);
  }
  if (appended.length > 0) {
    if (newLines.length > 0 && newLines[newLines.length - 1] !== '') newLines.push('');
    newLines.push(...appended);
  }
  // Ensure trailing newline.
  if (newLines.length === 0 || newLines[newLines.length - 1] !== '') newLines.push('');

  await atomicWrite(filePath, newLines.join('\n'));
  return { created: false, merged: true };
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp.${process.pid}`;
  await fs.writeFile(tmp, contents, 'utf8');
  await fs.rename(tmp, filePath);
}
