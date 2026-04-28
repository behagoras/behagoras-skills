import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

/**
 * Expand `~` and `$HOME` in a path string. Pure string substitution; never
 * resolves to absolute or hits the filesystem.
 */
export function expandHome(input: string): string {
  if (!input) return input;
  const home = homedir();
  if (input === '~') return home;
  if (input.startsWith('~/')) return path.join(home, input.slice(2));
  return input.replace(/\$HOME(?=\/|$)/g, home);
}

/**
 * Resolve a path to absolute, expanding `~` / `$HOME` first.
 * Relative paths anchor to `cwd` (defaults to `process.cwd()`).
 */
export function resolvePath(input: string, cwd: string = process.cwd()): string {
  return path.resolve(cwd, expandHome(input));
}

export interface ClaudePaths {
  scope: 'global' | 'local';
  /** ~/.claude or <cwd>/.claude */
  root: string;
  /** <root>/skills */
  skills: string;
  /** <root>/commands */
  commands: string;
}

export function claudePaths(scope: 'global' | 'local' = 'global', cwd: string = process.cwd()): ClaudePaths {
  const root = scope === 'global' ? path.join(homedir(), '.claude') : path.join(cwd, '.claude');
  return {
    scope,
    root,
    skills: path.join(root, 'skills'),
    commands: path.join(root, 'commands'),
  };
}

/**
 * Find the package/repo root containing `skills.json`. Walks up from `start`
 * (which defaults to the directory of this compiled module) until a
 * `skills.json` is found, or returns `null` if none.
 */
export async function findRepoRoot(start?: string): Promise<string | null> {
  const origin = start ?? path.dirname(fileURLToPath(import.meta.url));
  let dir = path.resolve(origin);
  // walk up to filesystem root
  while (true) {
    try {
      await fs.access(path.join(dir, 'skills.json'));
      return dir;
    } catch {
      // not here, keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Resolve the repo root, preferring a CLI override.
 * Throws when neither is available — that's a fatal misinstall.
 */
export async function resolveRepoRoot(override?: string): Promise<string> {
  if (override) return path.resolve(override);
  const found = await findRepoRoot();
  if (!found) {
    throw new Error(
      'Could not locate skills.json — pass --repo-root <path> or run from inside the package.'
    );
  }
  return found;
}
