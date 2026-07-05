---
description: Route a task between Claude and Codex on the personal machine (quality-price fit across both quotas)
argument-hint: task description or saved prompt reference
---

The user wants a task routed to the right executor (Claude native or Codex via `/codex:*`). Read and follow the instructions in `$HOME/.claude/skills/orchestrate-personal/SKILL.md` exactly.

Treat `$ARGUMENTS` as the task (or a reference to a saved `.prompts/` spec) to classify against the routing table, adapt if Codex-bound, dispatch, and log.
