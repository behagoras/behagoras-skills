import kleur from 'kleur';
import { loadManifest } from '../manifest.js';
import { resolveRepoRoot } from '../paths.js';
import { doctor, type DoctorReport } from '../doctor.js';

export interface DoctorOptions {
  scope?: 'global' | 'local';
  repoRoot?: string;
  skill?: string;
}

export async function runDoctor(opts: DoctorOptions = {}): Promise<number> {
  const repoRoot = await resolveRepoRoot(opts.repoRoot);
  const manifest = await loadManifest(repoRoot);
  const report = await doctor(manifest, {
    repoRoot,
    scope: opts.scope ?? 'global',
    onlySkill: opts.skill,
  });
  renderDoctorReport(report);
  return report.ok ? 0 : 1;
}

export function renderDoctorReport(report: DoctorReport): void {
  for (const r of report.skills) {
    console.log(kleur.bold(`\n${r.skill}: ${r.ok ? kleur.green('OK') : kleur.red('FAIL')}`));
    console.log(kleur.dim('  Required binaries:'));
    for (const b of r.binaries) {
      const mark = b.found ? kleur.green('✓') : kleur.red('✗');
      const where = b.found ? kleur.dim(`(${b.resolvedPath})`) : kleur.red('(not on PATH)');
      console.log(`    ${mark} ${b.binary} ${where}`);
    }
    if (r.optional.length > 0) {
      console.log(kleur.dim('  Optional binaries:'));
      for (const b of r.optional) {
        if (b.skipped) {
          console.log(
            `    ${kleur.dim('-')} ${b.binary} ${kleur.dim('(skipped — not applicable on this platform)')}`
          );
          continue;
        }
        const mark = b.found ? kleur.green('✓') : kleur.yellow('!');
        const where = b.found ? kleur.dim(`(${b.resolvedPath})`) : kleur.yellow('(missing)');
        const install = !b.found && b.install ? kleur.dim(` — try: ${b.install}`) : '';
        console.log(`    ${mark} ${b.binary} ${where}${install}`);
      }
    }
    console.log(kleur.dim('  Symlinks:'));
    for (const s of r.symlinks) {
      switch (s.status) {
        case 'ok':
          console.log(`    ${kleur.green('✓')} ${s.linkPath} -> ${kleur.dim(s.actualTarget!)}`);
          break;
        case 'missing':
          console.log(`    ${kleur.dim('-')} ${s.linkPath} ${kleur.dim('(not installed)')}`);
          break;
        case 'broken':
          console.log(
            `    ${kleur.red('✗')} ${s.linkPath} ${kleur.red(`(broken — points to ${s.actualTarget})`)}`
          );
          break;
        case 'wrong-target':
          console.log(
            `    ${kleur.yellow('!')} ${s.linkPath} ${kleur.yellow(`(points to ${s.actualTarget}, expected ${s.expectedTarget})`)}`
          );
          break;
        case 'not-symlink':
          console.log(
            `    ${kleur.yellow('!')} ${s.linkPath} ${kleur.yellow('(real file/dir, not a symlink)')}`
          );
          break;
      }
    }
  }
  console.log();
  console.log(report.ok ? kleur.green('All hard requirements pass.') : kleur.red('Some checks failed.'));
}
