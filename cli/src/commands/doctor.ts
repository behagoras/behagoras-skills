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
  let anyRequiredMissing = false;
  let anyOptionalMissing = false;
  for (const r of report.skills) {
    console.log(kleur.bold(`\n${r.skill}: ${r.ok ? kleur.green('OK') : kleur.red('FAIL')}`));
    console.log(kleur.dim('  Required binaries:'));
    for (const b of r.binaries) {
      if (!b.found) anyRequiredMissing = true;
      const mark = b.found ? kleur.green('✓') : kleur.red('✗');
      const where = b.found ? kleur.dim(`(${b.resolvedPath})`) : kleur.red('(not on PATH)');
      console.log(`    ${mark} ${b.binary} ${where}`);
    }
    if (r.optional.length > 0) {
      console.log(kleur.dim('  Optional binaries:'));
      for (const b of r.optional) {
        if (b.skipped) {
          // Rare path now that gating happens at collection time, but kept
          // for backwards compatibility with older callers.
          console.log(
            `    ${kleur.dim('-')} ${b.binary} ${kleur.dim('(skipped — not applicable on this platform)')}`
          );
          continue;
        }
        if (!b.found) anyOptionalMissing = true;
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
  if (anyRequiredMissing || anyOptionalMissing) {
    printInstallHints(anyRequiredMissing, anyOptionalMissing);
  }
  console.log();
  console.log(report.ok ? kleur.green('All hard requirements pass.') : kleur.red('Some checks failed.'));
}

/**
 * Print a platform-tailored install hint block when something is missing.
 *
 * We don't shell out — running `sudo apt` from a Node CLI is brittle (asks
 * for password mid-pipe, breaks on non-Debian, fights `pip --user` perms).
 * Printing keeps the user in control.
 */
function printInstallHints(requiredMissing: boolean, optionalMissing: boolean): void {
  const platform = process.platform;
  const heading = requiredMissing
    ? kleur.bold('\nMissing required deps. Install with:')
    : kleur.bold('\nOptional deps missing. Install with:');
  console.log(heading);
  if (platform === 'linux') {
    console.log('  sudo apt update && sudo apt install -y ffmpeg');
    console.log('  pip install -U --user yt-dlp');
    if (optionalMissing || requiredMissing) {
      console.log('  pip install -U --user faster-whisper  # optional, enables audio fallback');
    }
  } else if (platform === 'darwin') {
    console.log('  brew install ffmpeg yt-dlp');
    if (optionalMissing || requiredMissing) {
      console.log('  pip install -U mlx-whisper  # optional, enables audio fallback (Apple Silicon only)');
    }
  } else {
    console.log(`  (no canned hint for platform=${platform}; install yt-dlp, ffmpeg, python3 manually)`);
  }
}
