import path from 'node:path';
import kleur from 'kleur';
import { loadManifest } from '../manifest.js';
import { claudePaths, resolveRepoRoot } from '../paths.js';
import { inspectSymlink } from '../symlinks.js';

export interface ListOptions {
  scope?: 'global' | 'local';
  repoRoot?: string;
}

type Status = 'installed' | 'not installed' | 'broken-symlink' | 'installed-elsewhere';

export async function runList(opts: ListOptions = {}): Promise<number> {
  const repoRoot = await resolveRepoRoot(opts.repoRoot);
  const manifest = await loadManifest(repoRoot);
  const paths = claudePaths(opts.scope ?? 'global');

  const rows: Array<{ name: string; description: string; status: Status }> = [];
  for (const skill of manifest.skills) {
    const linkPath = path.join(paths.skills, skill.name);
    const expected = path.join(repoRoot, skill.path);
    const ins = await inspectSymlink(linkPath);
    let status: Status = 'not installed';
    if (ins.exists) {
      if (!ins.isSymlink) {
        status = 'installed-elsewhere';
      } else if (ins.broken) {
        status = 'broken-symlink';
      } else if (ins.resolvedTo === expected) {
        status = 'installed';
      } else {
        status = 'installed-elsewhere';
      }
    }
    rows.push({ name: skill.name, description: skill.description, status });
  }

  const nameW = Math.max(4, ...rows.map((r) => r.name.length));
  const statusW = Math.max(6, ...rows.map((r) => r.status.length));
  const header = `${pad('SKILL', nameW)}  ${pad('STATUS', statusW)}  DESCRIPTION`;
  console.log(kleur.bold(header));
  console.log(kleur.dim('-'.repeat(header.length)));
  for (const r of rows) {
    const colored =
      r.status === 'installed'
        ? kleur.green(pad(r.status, statusW))
        : r.status === 'broken-symlink'
          ? kleur.red(pad(r.status, statusW))
          : r.status === 'installed-elsewhere'
            ? kleur.yellow(pad(r.status, statusW))
            : kleur.dim(pad(r.status, statusW));
    console.log(`${pad(r.name, nameW)}  ${colored}  ${r.description}`);
  }
  return 0;
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}
