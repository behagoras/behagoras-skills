import { Command, Option } from 'commander';
import kleur from 'kleur';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runInstall } from './commands/install.js';
import { runList } from './commands/list.js';
import { runUninstall } from './commands/uninstall.js';
import { runDoctor } from './commands/doctor.js';
import { runUpdate } from './commands/update.js';

const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
const pkgVersion = JSON.parse(readFileSync(pkgPath, 'utf8')).version as string;

interface CommonFlags {
  yes?: boolean;
  scope?: 'global' | 'local';
  repoRoot?: string;
  force?: boolean;
}

function commonOptions(cmd: Command, includeForce = false): Command {
  cmd.option('-y, --yes', 'skip prompts and accept declared defaults', false);
  cmd.addOption(
    new Option('--scope <scope>', 'install scope').choices(['global', 'local']).default('global')
  );
  cmd.option('--repo-root <path>', 'override the package install location (development)');
  if (includeForce) {
    cmd.option('--force', 'replace divergent symlinks / overwrite rc files', false);
  }
  return cmd;
}

async function main(argv: string[]): Promise<number> {
  const program = new Command();

  program
    .name('behagoras-skills')
    .description('Claude Code skills installer — npx behagoras-skills install')
    .version(pkgVersion, '-v, --version', 'print the CLI version')
    .addHelpText(
      'after',
      `\nExamples:\n  $ npx behagoras-skills install\n  $ npx behagoras-skills install video-transcript\n  $ npx behagoras-skills doctor\n`
    );

  // install [skill]
  commonOptions(
    program
      .command('install')
      .description('install one or more skills (interactive when [skill] is omitted)')
      .argument('[skill]', 'skill name (e.g. video-transcript)')
      .action(async (skill: string | undefined, options: CommonFlags) => {
        const code = await runInstall(skill, options);
        process.exitCode = code;
      }),
    /* includeForce */ true
  );

  // list
  commonOptions(
    program
      .command('list')
      .description('list available skills and their installation status')
      .action(async (options: CommonFlags) => {
        const code = await runList(options);
        process.exitCode = code;
      })
  );

  // uninstall <skill>
  commonOptions(
    program
      .command('uninstall')
      .description('remove the symlinks created by install for a given skill')
      .argument('<skill>', 'skill name')
      .action(async (skill: string, options: CommonFlags) => {
        const code = await runUninstall(skill, options);
        process.exitCode = code;
      })
  );

  // doctor
  commonOptions(
    program
      .command('doctor')
      .description('verify required binaries and symlinks for installed skills')
      .option('--skill <name>', 'restrict checks to a single skill')
      .action(async (options: CommonFlags & { skill?: string }) => {
        const code = await runDoctor(options);
        process.exitCode = code;
      })
  );

  // update
  program
    .command('update')
    .description('git pull + reinstall dependencies (clone install only)')
    .option('--repo-root <path>', 'override the package install location (development)')
    .action(async (options: CommonFlags) => {
      const code = await runUpdate(options);
      process.exitCode = code;
    });

  await program.parseAsync(argv);
  const code = process.exitCode;
  return typeof code === 'number' ? code : 0;
}

main(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(kleur.red(`Error: ${msg}`));
  if (process.env.DEBUG) {
    console.error(err);
  }
  process.exit(1);
});
