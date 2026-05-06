# b7s-create-skill

Scaffold and iterate new skills directly inside the [behagoras-skills](../README.md) clone using the [`skill-creator`](https://docs.claude.com/en/docs/claude-code/skills) methodology — runs the full interview, draft, eval, and description-optimization loop, then wires the result into `skills.json`, slash commands, the `package.json` files array, and the root README skills table. Validates the manifest, runs `pnpm lint`, commits atomically, pushes the branch, and **opens a PR to `main`** with the release label chosen by the user so the publish workflow ships to npm automatically on merge. Mexican-Spanish personal-use skill (the conversation runs in Spanish; the published `description` and `README.md` of the new skill go in English).

> Looking for the model-facing contract? See [`SKILL.md`](./SKILL.md).

## Install

```bash
npx behagoras-skills install b7s-create-skill
```

## Companion skill

- [`skill-creator`](https://github.com/anthropics/claude-code) — the upstream methodology this skill orchestrates. `b7s-create-skill` delegates the creative loop to `skill-creator` and adds the behagoras-skills repo finalization (manifest, commands, README, packaging, commit).
