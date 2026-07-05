# orchestrate-work

Router skill for the work machine, where Gemini is unlimited/free (enterprise) and Claude is metered. Routes aggressively to Gemini (via `behagoras/gemini-plugin-cc`) everything it can reliably complete, reserves Claude for judgment-heavy work, and logs an estimate of Claude tokens avoided per task — the metric for the boss's token-spend experiment, with a weekly report script. Claude has no web access on that machine, so every web-shaped task routes to `/gemini:search`, zero exceptions.

> Looking for the model-facing contract? See [`SKILL.md`](./SKILL.md).

## Requires

- `behagoras/gemini-plugin-cc` plugin (`/gemini:search`, `/gemini:delegate`, `/gemini:adversarial`, …)
- `python3` for `scripts/weekly_report.py`

## Install

```bash
npx behagoras-skills install orchestrate-work
```
