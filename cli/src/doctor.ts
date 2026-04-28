import { promises as fs } from 'node:fs';
import path from 'node:path';
import { delimiter } from 'node:path';
import type { Manifest, Skill } from './manifest.js';
import { claudePaths } from './paths.js';
import { inspectSymlink } from './symlinks.js';

export interface BinaryCheck {
  binary: string;
  found: boolean;
  resolvedPath?: string;
  /** True if the optional binary doesn't apply to the current platform. */
  skipped?: boolean;
  /** Suggested install command (only set for optional binaries). */
  install?: string;
}

export interface SymlinkCheck {
  linkPath: string;
  status: 'ok' | 'missing' | 'broken' | 'wrong-target' | 'not-symlink';
  expectedTarget: string;
  actualTarget?: string;
}

export interface SkillReport {
  skill: string;
  binaries: BinaryCheck[];
  optional: BinaryCheck[];
  symlinks: SymlinkCheck[];
  ok: boolean;
}

export interface DoctorReport {
  skills: SkillReport[];
  ok: boolean;
}

/**
 * Walk PATH looking for a binary. Pure TS — no shell-out. We don't trust
 * `which` (it may or may not be installed; semantics differ by platform), so
 * we re-implement the lookup against `process.env.PATH`.
 */
export async function findOnPath(binary: string): Promise<string | null> {
  const PATH = process.env.PATH ?? '';
  if (!PATH) return null;
  const dirs = PATH.split(delimiter).filter(Boolean);
  // On non-Windows we don't need to try extensions.
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
    : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, `${binary}${ext}`);
      try {
        const st = await fs.stat(candidate);
        if (st.isFile()) {
          // On POSIX, also confirm it's executable; on Windows, presence is enough.
          if (process.platform === 'win32') return candidate;
          // Owner exec bit is the cheap heuristic.
          if ((st.mode & 0o111) !== 0) return candidate;
        }
      } catch {
        /* not here */
      }
    }
  }
  return null;
}

function platformTag(): string {
  return `${process.platform}-${process.arch}`;
}

/**
 * Decide whether an optional binary applies to the current platform.
 *
 * Preference order:
 *   1. `platforms` array (new) — match against `process.platform`.
 *   2. `platform` tag (legacy) — match against `<process.platform>-<process.arch>`.
 *   3. Neither — applies everywhere.
 */
function appliesToPlatform(o: { platform?: string; platforms?: string[] }): boolean {
  if (o.platforms && o.platforms.length > 0) {
    return o.platforms.includes(process.platform);
  }
  if (o.platform) return o.platform === platformTag();
  return true;
}

export async function doctorSkill(
  skill: Skill,
  opts: { repoRoot: string; scope?: 'global' | 'local'; cwd?: string }
): Promise<SkillReport> {
  const { repoRoot, scope = 'global', cwd = process.cwd() } = opts;
  const paths = claudePaths(scope, cwd);

  const binaries: BinaryCheck[] = [];
  for (const b of skill.requires.binaries) {
    const found = await findOnPath(b);
    binaries.push({ binary: b, found: !!found, resolvedPath: found ?? undefined });
  }

  const optional: BinaryCheck[] = [];
  for (const o of skill.requires.optional ?? []) {
    if (!appliesToPlatform(o)) {
      // Don't even include skipped entries in the report — the doctor's
      // current renderer treats them as noise. Filtering at the source
      // keeps the output clean on Linux (no mlx_whisper line) and on
      // macOS (no whisper-ctranslate2 line).
      continue;
    }
    const found = await findOnPath(o.binary);
    optional.push({
      binary: o.binary,
      found: !!found,
      resolvedPath: found ?? undefined,
      install: o.install,
    });
  }

  const symlinks: SymlinkCheck[] = [];
  // Skill folder symlink
  {
    const linkPath = path.join(paths.skills, skill.name);
    const expectedTarget = path.join(repoRoot, skill.path);
    const ins = await inspectSymlink(linkPath);
    symlinks.push(buildSymlinkCheck(linkPath, expectedTarget, ins));
  }
  for (const cmd of skill.commands) {
    const linkPath = path.join(paths.commands, `${cmd}.md`);
    const expectedTarget = path.join(repoRoot, 'commands', `${cmd}.md`);
    const ins = await inspectSymlink(linkPath);
    symlinks.push(buildSymlinkCheck(linkPath, expectedTarget, ins));
  }

  // Hard requirement = required binaries + symlinks not broken/wrong/not-symlink.
  // 'missing' is also failure once the user has run install; but if NOTHING is
  // installed yet, that's noise. We treat 'missing' as "not installed" — not a
  // doctor failure on its own. Failures are: any required binary missing, any
  // symlink that's broken/wrong-target/not-symlink.
  const installed = symlinks.some((s) => s.status === 'ok');
  const symlinkOk =
    !installed
      ? true
      : symlinks.every((s) => s.status === 'ok');
  const binariesOk = binaries.every((b) => b.found);
  return {
    skill: skill.name,
    binaries,
    optional,
    symlinks,
    ok: binariesOk && symlinkOk,
  };
}

function buildSymlinkCheck(
  linkPath: string,
  expectedTarget: string,
  ins: Awaited<ReturnType<typeof inspectSymlink>>
): SymlinkCheck {
  if (!ins.exists) return { linkPath, expectedTarget, status: 'missing' };
  if (!ins.isSymlink) return { linkPath, expectedTarget, status: 'not-symlink', actualTarget: linkPath };
  if (ins.broken) return { linkPath, expectedTarget, status: 'broken', actualTarget: ins.pointsTo };
  if (ins.resolvedTo !== expectedTarget) {
    return { linkPath, expectedTarget, status: 'wrong-target', actualTarget: ins.resolvedTo };
  }
  return { linkPath, expectedTarget, status: 'ok', actualTarget: ins.resolvedTo };
}

export async function doctor(
  manifest: Manifest,
  opts: { repoRoot: string; scope?: 'global' | 'local'; cwd?: string; onlySkill?: string }
): Promise<DoctorReport> {
  const reports: SkillReport[] = [];
  for (const skill of manifest.skills) {
    if (opts.onlySkill && skill.name !== opts.onlySkill) continue;
    reports.push(await doctorSkill(skill, opts));
  }
  return { skills: reports, ok: reports.every((r) => r.ok) };
}
