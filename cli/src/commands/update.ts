import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import kleur from 'kleur';
import { resolveRepoRoot } from '../paths.js';

export interface UpdateOptions {
  repoRoot?: string;
}

/**
 * `update` is the only command that performs network calls. We detect whether
 * the package was invoked from a git clone vs from an npx tmp install:
 *
 * - If `<repoRoot>/.git` exists → clone path: `git pull` then run the
 *   appropriate package manager based on the lockfile present.
 * - Otherwise → npx tmp install: instruct the user to re-run with @latest.
 */
export async function runUpdate(opts: UpdateOptions = {}): Promise<number> {
  const repoRoot = await resolveRepoRoot(opts.repoRoot);
  const isClone = await pathExists(path.join(repoRoot, '.git'));

  if (!isClone) {
    console.log(
      kleur.cyan(
        'This package looks like it was launched via npx (no .git directory).\n' +
          'Run `npx behagoras-skills@latest install` for the latest version.'
      )
    );
    return 0;
  }

  console.log(kleur.bold(`Updating clone at ${repoRoot}…`));
  const gitPull = await runCmd('git', ['pull', '--ff-only'], repoRoot);
  if (gitPull !== 0) {
    console.error(kleur.red('git pull failed.'));
    return gitPull;
  }

  // Pick a package manager based on which lockfile is present.
  const pkgManager = await detectPackageManager(repoRoot);
  if (!pkgManager) {
    console.log(kleur.yellow('No lockfile found — skipping dependency install.'));
    return 0;
  }
  console.log(kleur.bold(`\nRunning ${pkgManager} install…`));
  const install = await runCmd(pkgManager, ['install'], repoRoot);
  if (install !== 0) {
    console.error(kleur.red(`${pkgManager} install failed.`));
    return install;
  }
  console.log(kleur.green('\nUpdate complete.'));
  return 0;
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
