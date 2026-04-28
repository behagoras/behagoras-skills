import { promises as fs } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';

export type Platform = 'darwin' | 'linux' | 'win32';

export interface OptionalBinary {
  binary: string;
  /** Legacy single-tag platform field (e.g. `darwin-arm64`). Prefer `platforms`. */
  platform?: string;
  /** Restrict to one or more `process.platform` values. When omitted, applies to all platforms. */
  platforms?: Platform[];
  install?: string;
}

export interface SkillRequires {
  binaries: string[];
  optional?: OptionalBinary[];
}

export interface PromptChoice {
  label: string;
  value: string;
}

export interface PromptWrites {
  file: string;
  key: string;
}

export interface SkillPrompt {
  key: string;
  question: string;
  type: 'select' | 'confirm' | 'input';
  choices?: PromptChoice[];
  default?: string | boolean | number;
  writes: PromptWrites;
}

export interface Skill {
  name: string;
  description: string;
  path: string;
  commands: string[];
  requires: SkillRequires;
  prompts: SkillPrompt[];
}

export interface Manifest {
  $schema?: string;
  skills: Skill[];
}

let cachedValidator: ValidateFunction<Manifest> | null = null;

async function loadValidator(repoRoot: string): Promise<ValidateFunction<Manifest>> {
  if (cachedValidator) return cachedValidator;
  const schemaPath = path.join(repoRoot, 'skills.schema.json');
  const schemaRaw = await fs.readFile(schemaPath, 'utf8');
  const schema = JSON.parse(schemaRaw);
  // Strip $schema meta-ref Ajv would otherwise try to fetch.
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  cachedValidator = ajv.compile<Manifest>(schema);
  return cachedValidator;
}

export async function loadManifest(repoRoot: string): Promise<Manifest> {
  const manifestPath = path.join(repoRoot, 'skills.json');
  const raw = await fs.readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as Manifest;
  const validate = await loadValidator(repoRoot);
  if (!validate(parsed)) {
    const errors = (validate.errors ?? [])
      .map((e) => `  - ${e.instancePath || '/'} ${e.message ?? 'invalid'}`)
      .join('\n');
    throw new Error(`skills.json failed schema validation:\n${errors}`);
  }
  return parsed;
}

export function findSkill(manifest: Manifest, name: string): Skill | undefined {
  return manifest.skills.find((s) => s.name === name);
}
