---
description: Re-ask the questions Claude just posed in plain text using the structured AskUserQuestion UI
argument-hint: (optional) hint to focus on a specific question if multiple were asked
---

The user wants to answer recent plain-text questions via the `AskUserQuestion` selection UI instead of typing a freeform reply. Read and follow the instructions in `$HOME/.claude/skills/b7s-ask/SKILL.md` exactly.

Treat `$ARGUMENTS` as an optional filter — if the model asked multiple unrelated questions, the user can scope this to just one topic. The conversation language matches whatever the recent turns were in (default Mexican Spanish).
