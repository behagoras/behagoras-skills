# b7s-prioritize

The third leg of the b7s trio. Cross-references live TODOs in `.brainstorms/` against the executable prompts they spawned, scores each prompt by urgency + dependencies + TODO volume + brainstorm freshness, and returns a ranked "next 3-5 prompts to run" list with READY/PARTIAL/BLOCKED readiness flags. Read-only — no file edits. Mexican-Spanish personal-use skill that pairs naturally with [`b7s-brainstorm`](../b7s-brainstorm/README.md) and [`b7s-review`](../b7s-review/README.md).

> Looking for the model-facing contract? See [`SKILL.md`](./SKILL.md).

## Install

```bash
npx behagoras-skills install b7s-prioritize
```
