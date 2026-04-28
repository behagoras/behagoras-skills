import path from 'node:path';
import kleur from 'kleur';
import { confirm } from '@inquirer/prompts';
import { loadManifest } from '../manifest.js';
import { claudePaths, resolveRepoRoot } from '../paths.js';
import { inspectSymlink, removeSymlink } from '../symlinks.js';

export interface UninstallOptions {
  yes?: boolean;
  scope?: 'global' | 'local';
  repoRoot?: string;
}

export async function runUninstall(skillName: string, opts: UninstallOptions = {}): Promise<number> {
  const repoRoot = await resolveRepoRoot(opts.repoRoot);
  const manifest = await loadManifest(repoRoot);
  const skill = manifest.skills.find((s) => s.name === skillName);
  if (!skill) {
    console.error(kleur.red(`Unknown skill: ${skillName}`));
    return 1;
  }

  const paths = claudePaths(opts.scope ?? 'global');
  const skillLink = path.join(paths.skills, skill.name);

  if (!opts.yes) {
    const ok = await confirm({
      message: `Remove symlinks for "${skill.name}" from ${paths.root}?`,
      default: true,
    });
    if (!ok) {
      console.log(kleur.yellow('Cancelled.'));
      return 0;
    }
  }

  let removed = 0;
  let skipped = 0;

  // Skill folder
  removed += await removeIfSymlink(skillLink);

  // Each command
  for (const cmd of skill.commands) {
    const cmdLink = path.join(paths.commands, `${cmd}.md`);
    removed += await removeIfSymlink(cmdLink);
  }

  console.log(kleur.green(`\nRemoved ${removed} symlink${removed === 1 ? '' : 's'}.`));
  if (skipped > 0) {
    console.log(kleur.yellow(`Skipped ${skipped} non-symlink path${skipped === 1 ? '' : 's'}.`));
  }
  console.log(
    kleur.dim('Note: skill folder, .transcriptsrc, and your repo clone are untouched.')
  );
  return 0;

  async function removeIfSymlink(p: string): Promise<number> {
    const ins = await inspectSymlink(p);
    if (!ins.exists) {
      console.log(`  ${kleur.dim('•')} not present: ${p}`);
      return 0;
    }
    if (!ins.isSymlink) {
      console.log(`  ${kleur.yellow('!')} not a symlink, leaving alone: ${p}`);
      skipped++;
      return 0;
    }
    await removeSymlink(p);
    console.log(`  ${kleur.green('✓')} removed: ${p}`);
    return 1;
  }
}
