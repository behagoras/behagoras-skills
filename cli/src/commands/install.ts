import path from 'node:path';
import kleur from 'kleur';
import { checkbox } from '@inquirer/prompts';
import { loadManifest, type Manifest, type Skill } from '../manifest.js';
import { claudePaths, resolveRepoRoot, resolvePath } from '../paths.js';
import { ensureSymlink, inspectSymlink } from '../symlinks.js';
import { runPrompts, type PromptAnswers } from '../prompts.js';
import { readRc, writeRc } from '../rcfile.js';
import { doctor } from '../doctor.js';
import { renderDoctorReport } from './doctor.js';

export interface InstallOptions {
  yes?: boolean;
  scope?: 'global' | 'local';
  repoRoot?: string;
  force?: boolean;
}

export async function runInstall(skillName: string | undefined, opts: InstallOptions = {}): Promise<number> {
  const repoRoot = await resolveRepoRoot(opts.repoRoot);
  const manifest = await loadManifest(repoRoot);
  const scope = opts.scope ?? 'global';
  const paths = claudePaths(scope);

  const targets = await selectSkills(manifest, skillName, opts);
  if (targets.length === 0) {
    console.log(kleur.yellow('Nothing selected — exiting.'));
    return 0;
  }

  let exitCode = 0;
  for (const skill of targets) {
    console.log(kleur.bold().cyan(`\n→ ${skill.name}`));

    // (a) ensure ~/.claude/skills + ~/.claude/commands
    // ensureSymlink will mkdir parent on first link, but make these explicit so
    // doctor against a brand-new HOME finds an empty commands/ dir.
    const { promises: fs } = await import('node:fs');
    await fs.mkdir(paths.skills, { recursive: true });
    await fs.mkdir(paths.commands, { recursive: true });

    // (b) symlink skill folder + each command
    const skillLink = path.join(paths.skills, skill.name);
    const skillTarget = path.join(repoRoot, skill.path);
    const r = await ensureSymlink(skillLink, skillTarget, { force: opts.force });
    logSymlinkResult(r);
    if (r.status === 'conflict-file' || r.status === 'conflict-dir' || r.status === 'diverged') {
      exitCode = 1;
    }

    for (const cmd of skill.commands) {
      const linkPath = path.join(paths.commands, `${cmd}.md`);
      const target = path.join(repoRoot, 'commands', `${cmd}.md`);
      const cr = await ensureSymlink(linkPath, target, { force: opts.force });
      logSymlinkResult(cr);
      if (cr.status === 'conflict-file' || cr.status === 'conflict-dir' || cr.status === 'diverged') {
        exitCode = 1;
      }
    }

    // (c) prompts → rc files (in CWD)
    if (skill.prompts.length > 0) {
      const answers = await runPrompts(skill.prompts, { yes: opts.yes });
      await writeAnswersToRcFiles(skill, answers, { force: opts.force });
    }
  }

  // (d) doctor summary
  console.log(kleur.bold('\nDoctor report:'));
  const report = await doctor(manifest, { repoRoot, scope });
  renderDoctorReport(report);
  if (!report.ok) exitCode = exitCode || 1;

  return exitCode;
}

async function selectSkills(
  manifest: Manifest,
  skillName: string | undefined,
  opts: InstallOptions
): Promise<Skill[]> {
  if (skillName) {
    const skill = manifest.skills.find((s) => s.name === skillName);
    if (!skill) {
      throw new Error(`Unknown skill: ${skillName}. Run \`list\` to see available skills.`);
    }
    return [skill];
  }
  if (opts.yes) {
    // --yes with no specific skill → install everything.
    return manifest.skills;
  }
  // Interactive multi-select. Pre-check skills not yet installed.
  const paths = claudePaths(opts.scope ?? 'global');
  const choices = await Promise.all(
    manifest.skills.map(async (s) => {
      const ins = await inspectSymlink(path.join(paths.skills, s.name));
      const installed = ins.exists && ins.isSymlink && !ins.broken;
      return {
        name: `${s.name} — ${s.description}${installed ? kleur.dim(' (installed)') : ''}`,
        value: s.name,
        checked: !installed,
      };
    })
  );
  const selected = (await checkbox({
    message: 'Select skills to install:',
    choices,
  })) as string[];
  return manifest.skills.filter((s) => selected.includes(s.name));
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
    case 'diverged':
      console.log(`  ${kleur.yellow('!')} ${r.message}`);
      break;
    case 'conflict-file':
    case 'conflict-dir':
      console.log(`  ${kleur.red('✗')} ${r.message}`);
      break;
    default:
      console.log(`  ${r.message}`);
  }
}

async function writeAnswersToRcFiles(
  skill: import('../manifest.js').Skill,
  answers: PromptAnswers,
  opts: { force?: boolean }
): Promise<void> {
  // Group answers by target file.
  const byFile = new Map<string, Record<string, string>>();
  for (const p of skill.prompts) {
    if (!(p.key in answers)) continue;
    const value = answers[p.key];
    const stringValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
    const file = p.writes.file;
    const bucket = byFile.get(file) ?? {};
    bucket[p.writes.key] = stringValue;
    byFile.set(file, bucket);
  }

  for (const [filename, kv] of byFile) {
    const filePath = resolvePath(filename);
    const existing = await readRc(filePath);
    if (existing.exists && !opts.force) {
      console.log(
        `  ${kleur.dim('•')} ${filename} already exists — merging keys (use --force to overwrite the file).`
      );
      await writeRc(filePath, kv);
      console.log(`  ${kleur.green('✓')} merged keys into ${filePath}`);
      continue;
    }
    const header = filename === '.transcriptsrc'
      ? '# .transcriptsrc — video-transcript skill config (created by behagoras-skills CLI).\n# See https://github.com/behagoras/behagoras-skills for the full key list.\n'
      : `# ${filename} — written by behagoras-skills CLI\n`;
    await writeRc(filePath, kv, { header, overwrite: !!opts.force });
    console.log(`  ${kleur.green('✓')} wrote ${filePath}`);
  }
}
