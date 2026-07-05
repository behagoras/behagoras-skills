---
description: Route a work-machine task to Gemini by default, Claude only for judgment-heavy work; log Claude tokens saved
argument-hint: task description or saved prompt reference
---

The user wants a work-machine task routed (Gemini via `/gemini:*` by default; Claude reserved). Read and follow the instructions in `$HOME/.claude/skills/orchestrate-work/SKILL.md` exactly.

Treat `$ARGUMENTS` as the task (or a reference to a saved `.prompts/` spec) to classify against the routing table, adapt for Gemini if dispatched there, and log with the Claude-tokens-avoided estimate.
