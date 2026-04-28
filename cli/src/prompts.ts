import { confirm, input, select } from '@inquirer/prompts';
import { homedir } from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { SkillPrompt } from './manifest.js';

export type PromptAnswers = Record<string, string | boolean>;

export interface RunPromptsOptions {
  /** When true, skip prompts and return the declared defaults. */
  yes?: boolean;
}

/**
 * Render a skill's `prompts[]` interactively (or non-interactively when
 * `--yes` is set) and return the answers keyed by `prompt.key`.
 *
 * The CLI is generic: each prompt knows what file/key it writes to via
 * `prompt.writes`, but this function is concerned only with collection.
 */
export async function runPrompts(
  prompts: SkillPrompt[],
  opts: RunPromptsOptions = {}
): Promise<PromptAnswers> {
  const answers: PromptAnswers = {};

  for (const p of prompts) {
    if (opts.yes) {
      answers[p.key] = await defaultValueFor(p);
      continue;
    }

    if (p.type === 'confirm') {
      const dflt = typeof p.default === 'boolean' ? p.default : false;
      answers[p.key] = await confirm({ message: p.question, default: dflt });
      continue;
    }

    if (p.type === 'input') {
      const dflt = typeof p.default === 'string' ? p.default : '';
      answers[p.key] = await input({ message: p.question, default: dflt });
      continue;
    }

    // select
    const choices = (p.choices ?? []).map((c) => ({ name: c.label, value: c.value }));
    const selected = await select({
      message: p.question,
      choices,
      default: typeof p.default === 'string' ? p.default : choices[0]?.value,
    });

    if (selected === '<custom>') {
      const custom = await input({
        message: 'Enter a custom path:',
        default: typeof p.default === 'string' ? p.default : '',
      });
      answers[p.key] = custom;
    } else if (selected === '<obsidian-autodetect>') {
      const detected = await autodetectObsidianVault();
      answers[p.key] = detected ?? './.transcripts';
    } else {
      answers[p.key] = selected;
    }
  }

  return answers;
}

async function defaultValueFor(p: SkillPrompt): Promise<string | boolean> {
  if (p.type === 'confirm') {
    return typeof p.default === 'boolean' ? p.default : false;
  }
  if (p.type === 'input') {
    return typeof p.default === 'string' ? p.default : '';
  }
  // select
  const dflt = typeof p.default === 'string' ? p.default : (p.choices?.[0]?.value ?? '');
  if (dflt === '<obsidian-autodetect>') {
    return (await autodetectObsidianVault()) ?? './.transcripts';
  }
  if (dflt === '<custom>') {
    // No interactive escape hatch in --yes mode; fall back to the first non-meta choice.
    const real = p.choices?.find((c) => !c.value.startsWith('<')); // skip meta values
    return real?.value ?? './.transcripts';
  }
  return dflt;
}

/**
 * Find an Obsidian vault under $HOME by looking for `.obsidian` directories,
 * up to 4 levels deep. Returns the vault path (parent of `.obsidian`) or null.
 */
export async function autodetectObsidianVault(): Promise<string | null> {
  const home = homedir();
  return walk(home, 4);

  async function walk(dir: string, depth: number): Promise<string | null> {
    if (depth < 0) return null;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.obsidian') return dir;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;
      const sub = path.join(dir, entry.name);
      const found = await walk(sub, depth - 1);
      if (found) return found;
    }
    return null;
  }
}
