---
description: Scaffold a new skill in the behagoras-skills clone using the skill-creator loop, commit atomically, and open a PR
argument-hint: (optional) tentative skill name (kebab-case) or topic
---

The user wants to create a new skill inside the local `behagoras-skills` clone. Read and follow the instructions in `$HOME/.claude/skills/b7s-create-skill/SKILL.md` exactly.

Treat `$ARGUMENTS` as a tentative skill name (kebab-case, often `b7s-*`) or a topic hint that becomes the skill's purpose. The conversation runs in **Mexican Spanish**; the published `description` and `README.md` of the new skill always go in English. The skill ends by opening a PR to `main` with a release label chosen by the user.
