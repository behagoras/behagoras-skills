---
description: Rank executable prompts by urgency, dependencies, and TODO coverage — closes the b7s trio
argument-hint: (optional) top-N number, slug, or specific prompt id to expand
---

The user wants to decide which executable prompt to run next. Read and follow the instructions in `$HOME/.claude/skills/b7s-prioritize/SKILL.md` exactly.

If `$ARGUMENTS` is set, treat it as either a top-N limit (e.g. `5`), a slug or numeric id to expand a single prompt, `all` to scan every category under `prompts/`, or `path:<dir>` to override the executable-prompts directory. Otherwise, default to top-5 from the auto-detected prompts directory. The conversation runs in **Mexican Spanish**.
