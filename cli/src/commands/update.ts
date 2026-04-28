import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import kleur from 'kleur';
import { loadManifest, type Manifest, type Skill, type SkillPrompt } from '../manifest.js';
import { claudePaths, resolveRepoRoot, resolvePath } from '../paths.js';
import { ensureSymlink, inspectSymlink, removeSymlink } from '../symlinks.js';
import { runPrompts } from '../prompts.js';
import { readRc, writeRc } from '../rcfile.js';
import { doctor } from '../doctor.js';
import { renderDoctorReport } from './doctor.js';
import { runUninstall } from './uninstall.js';
import { runInstall } from './install.js';

export interface UpdateOptions {
  repoRoot?: string;
  scope?: 'global' | 'local';
  yes?: boolean;
  /** Destructive: uninstall every skill, then reinstall. Bypasses incremental sync. */
  clean?: boolean;
  /**
   * Remove symlinks that point at this repo but no longer correspond to a
   * manifest-declared command. Off by default — manifest changes are usually
   * additive and prune surprises hand-edited setups.
   */
  prune?: boolean;
}

/**
 * `update` keeps an installed setup in sync with the current manifest without
 * losing user state. Two modes:
 *
 *   - DEFAULT (incremental):
 *       For each skill in the manifest:
 *         * relink any divergent skill/command symlinks (e.g. stale npx tmp
 *           paths) to the current repo root
 *         * create any newly-declared command symlinks
 *         * for each prompt's writes target, add only the keys missing from
 *           the user's rcfile (existing values are preserved verbatim)
 *       Removed manifest entries are left alone unless --prune is passed.
 *
 *   - --clean:
 *       Run `uninstall --yes` for every installed skill, then `install --yes`.
 *       Use only when a normal update fails or when migrating to a different
 *       scope. This blows away user-configured state.
 *
 * If the working directory is a git clone (a `.git` exists), we also `git pull`
 * the repo and re-run the package manager install — keeping the dev path
 * one-stop.
 */
export async function runUpdate(opts: UpdateOptions = {}): Promise<number> {
  const repoRoot = await resolveRepoRoot(opts.repoRoot);
  const isClone = await pathExists(path.join(repoRoot, '.git'));

  if (isClone) {
    console.log(kleur.bold(`Updating clone at ${repoRoot}…`));
    // Soft-fail on `git pull`: a feature branch without upstream, a detached
    // HEAD, or a network blip should not block the symlink/rcfile reconcile.
    const gitPull = await runCmd('git', ['pull', '--ff-only'], repoRoot);
    if (gitPull !== 0) {
      console.log(
        kleur.yellow('git pull skipped/failed — continuing with local manifest reconciliation.')
      );
    } else {
      const pkgManager = await detectPackageManager(repoRoot);
      if (pkgManager) {
        console.log(kleur.bold(`\nRunning ${pkgManager} install…`));
        const installRc = await runCmd(pkgManager, ['install'], repoRoot);
        if (installRc !== 0) {
          console.error(kleur.red(`${pkgManager} install failed.`));
          return installRc;
        }
      } else {
        console.log(kleur.yellow('No lockfile found — skipping dependency install.'));
      }
    }
  } else {
    console.log(
      kleur.cyan(
        'No .git directory — skipping git pull. Re-run via `npx behagoras-skills@latest update` to pick up new package versions.'
      )
    );
  }

  const manifest = await loadManifest(repoRoot);
  const scope = opts.scope ?? 'global';

  if (opts.clean) {
    return runCleanUpdate(manifest, { repoRoot, scope, yes: opts.yes });
  }

  console.log(kleur.bold('\nReconciling installed skills with manifest…'));
  let exitCode = 0;
  for (const skill of manifest.skills) {
    console.log(kleur.bold().cyan(`\n→ ${skill.name}`));
    const skillRc = await reconcileSkill(skill, { repoRoot, scope, yes: opts.yes });
    exitCode = exitCode || skillRc;
  }

  if (opts.prune) {
    const pruneRc = await pruneStaleSymlinks(manifest, { repoRoot, scope });
    exitCode = exitCode || pruneRc;
  }

  console.log(kleur.bold('\nDoctor report:'));
  const report = await doctor(manifest, { repoRoot, scope });
  renderDoctorReport(report);
  if (!report.ok) exitCode = exitCode || 1;
  console.log(kleur.green('\nUpdate complete.'));
  return exitCode;
}

/**
 * --clean: uninstall every manifest skill (best-effort) then install everything
 * fresh. Skipped over any skill whose uninstall fails — install will still
 * recreate symlinks. Rcfiles are NOT touched by uninstall, so user config
 * survives.
 */
async function runCleanUpdate(
  manifest: Manifest,
  opts: { repoRoot: string; scope: 'global' | 'local'; yes?: boolean }
): Promise<number> {
  console.log(
    kleur.yellow(
      '\n--clean: uninstalling and reinstalling every skill. Use only when a normal update fails.'
    )
  );
  for (const s of manifest.skills) {
    await runUninstall(s.name, { ...opts, yes: true });
  }
  return runInstall(undefined, { ...opts, yes: opts.yes ?? true });
}

/**
 * Bring one skill's symlinks + rcfile keys in line with the manifest.
 *
 * Symlinks: ensureSymlink with `force: true` — divergent links (e.g. stale
 * npx _npx/<hash>/... paths) get re-pointed to the current repo root. We
 * never overwrite real files/dirs (the symlinks state machine refuses).
 *
 * Rcfile: read existing keys, then for each `writes` target in the prompts,
 * only add keys that are MISSING. Existing values are preserved verbatim
 * even if they differ from the manifest default.
 */
async function reconcileSkill(
  skill: Skill,
  opts: { repoRoot: string; scope: 'global' | 'local'; yes?: boolean }
): Promise<number> {
  const paths = claudePaths(opts.scope);
  await fs.mkdir(paths.skills, { recursive: true });
  await fs.mkdir(paths.commands, { recursive: true });

  let exitCode = 0;
  const skillLink = path.join(paths.skills, skill.name);
  const skillTarget = path.join(opts.repoRoot, skill.path);
  const r = await ensureSymlink(skillLink, skillTarget, { force: true });
  logSymlinkResult(r);
  if (r.status === 'conflict-file' || r.status === 'conflict-dir') exitCode = 1;

  for (const cmd of skill.commands) {
    const linkPath = path.join(paths.commands, `${cmd}.md`);
    const target = path.join(opts.repoRoot, 'commands', `${cmd}.md`);
    const cr = await ensureSymlink(linkPath, target, { force: true });
    logSymlinkResult(cr);
    if (cr.status === 'conflict-file' || cr.status === 'conflict-dir') exitCode = 1;
  }

  // Reconcile rcfile keys: add missing, preserve existing.
  await reconcileRcKeys(skill, { yes: opts.yes });
  return exitCode;
}

async function reconcileRcKeys(skill: Skill, opts: { yes?: boolean }): Promise<void> {
  // Group prompts by destination file.
  const byFile = new Map<string, SkillPrompt[]>();
  for (const p of skill.prompts) {
    const arr = byFile.get(p.writes.file) ?? [];
    arr.push(p);
    byFile.set(p.writes.file, arr);
  }

  for (const [filename, prompts] of byFile) {
    const filePath = resolvePath(filename);
    const existing = await readRc(filePath);
    if (!existing.exists) {
      console.log(`  ${kleur.dim('•')} ${filename} not present — skipping (run install to create).`);
      continue;
    }
    const missing = prompts.filter((p) => !(p.writes.key in existing.values));
    if (missing.length === 0) {
      console.log(`  ${kleur.dim('•')} ${filename} up to date.`);
      continue;
    }

    let answers: Record<string, string | number | boolean> = {};
    if (opts.yes) {
      // Accept declared defaults silently for missing keys.
      for (const p of missing) {
        if (p.default !== undefined) answers[p.key] = p.default;
      }
      console.log(
        `  ${kleur.yellow('+')} ${filename}: adding ${missing.length} new key(s) with declared defaults (--yes).`
      );
    } else {
      console.log(
        `  ${kleur.yellow('+')} ${filename}: ${missing.length} new key(s) declared in manifest. Prompting…`
      );
      answers = await runPrompts(missing, { yes: false });
    }

    const kv: Record<string, string> = {};
    for (const p of missing) {
      if (!(p.key in answers)) continue;
      const v = answers[p.key];
      kv[p.writes.key] = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
    }
    if (Object.keys(kv).length > 0) {
      await writeRc(filePath, kv);
      console.log(`  ${kleur.green('✓')} ${filename}: added ${Object.keys(kv).join(', ')}`);
    }
  }
}

/**
 * Walk the global skills/commands dirs and warn (or remove, with --prune)
 * any symlink pointing at this repo but no longer declared by the manifest.
 *
 * Manifest changes are typically additive, but a skill rename or a removed
 * slash command would otherwise leave dangling links forever.
 */
async function pruneStaleSymlinks(
  manifest: Manifest,
  opts: { repoRoot: string; scope: 'global' | 'local' }
): Promise<number> {
  const paths = claudePaths(opts.scope);
  const declaredSkillTargets = new Set(
    manifest.skills.map((s) => path.join(opts.repoRoot, s.path))
  );
  const declaredCommandTargets = new Set(
    manifest.skills.flatMap((s) =>
      s.commands.map((c) => path.join(opts.repoRoot, 'commands', `${c}.md`))
    )
  );

  console.log(kleur.bold('\nPruning stale symlinks (--prune)…'));
  let removed = 0;

  removed += await pruneOne(paths.skills, declaredSkillTargets, opts.repoRoot);
  removed += await pruneOne(paths.commands, declaredCommandTargets, opts.repoRoot);

  if (removed === 0) {
    console.log(kleur.dim('  Nothing to prune.'));
  } else {
    console.log(kleur.green(`  Removed ${removed} stale symlink${removed === 1 ? '' : 's'}.`));
  }
  return 0;
}

async function pruneOne(dir: string, declared: Set<string>, repoRoot: string): Promise<number> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of entries) {
    const linkPath = path.join(dir, name);
    const ins = await inspectSymlink(linkPath);
    if (!ins.exists || !ins.isSymlink || !ins.resolvedTo) continue;
    // Only consider links that point inside our repo — leave hand-rolled ones alone.
    if (!ins.resolvedTo.startsWith(repoRoot + path.sep) && ins.resolvedTo !== repoRoot) continue;
    if (declared.has(ins.resolvedTo)) continue;
    await removeSymlink(linkPath);
    console.log(`  ${kleur.yellow('-')} pruned ${linkPath} (was -> ${ins.resolvedTo})`);
    removed += 1;
  }
  return removed;
}

function logSymlinkResult(r: { status: string; message: string }): void {
  switch (r.status) {
    case 'created':
      console.log(`  ${kleur.green('✓')} ${r.message}`);
      break;
    case 'already':
      console.log(`  ${kleur.dim('•')} ${r.message}`);
      break;
    case 'replaced':
      console.log(`  ${kleur.yellow('↻')} ${r.message}`);
      break;
    case 'conflict-file':
    case 'conflict-dir':
      console.log(`  ${kleur.red('✗')} ${r.message}`);
      break;
    default:
      console.log(`  ${r.message}`);
  }
}

async function detectPackageManager(repoRoot: string): Promise<'pnpm' | 'npm' | 'yarn' | null> {
  if (await pathExists(path.join(repoRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await pathExists(path.join(repoRoot, 'package-lock.json'))) return 'npm';
  if (await pathExists(path.join(repoRoot, 'yarn.lock'))) return 'yarn';
  return null;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function runCmd(cmd: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 0));
  });
}
