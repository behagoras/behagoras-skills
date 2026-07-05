# Dispatch notes (gemini-plugin-cc mechanics)

Field-tested against gemini-plugin-cc PR #2 (streaming observability) and Gemini CLI v0.46-v0.49. Re-verify paths and versions on the work machine at install time.

## Direct path (default)

```bash
node "<plugin-root>/scripts/gemini-run.mjs" run --stream [--read-only|--yolo] [--model gemini-3.5-flash] --include <dir> --stdin
```

Launch in background Bash. The script prints the run's log path at launch — follow it (`tail -f`, or `Read` the file if `BashOutput` is unavailable in the session). Each run writes `~/.gemini-runs/<ts>-<slug>/`: `run.log` (live), `meta.json` (status/duration/model), `response.txt`, `stream.jsonl`. `--timeout <secs>` overrides the 30-min cap.

- `CLAUDE_PLUGIN_ROOT` may be unset outside plugin context — resolve the plugin's absolute path instead of assuming the env var.
- `--stream` (`-o stream-json`) works on CLI v0.46+; skill docs may lag the installed CLI version.

## gemini-executor subagent (exception, not default)

Only for runs whose output is huge and must be summarized away from the main context. Launching it costs a subagent context (~15-30k Claude input tokens) before Gemini starts — always record that spend in the savings log. It is pinned to `model: haiku` + `effort: low` (thin wrapper; the helper script does format fallbacks, error classification, and output caps).

## Exit codes

| Code | Meaning | Response |
|------|---------|----------|
| 0 | success | proceed to verification/close |
| 2/3 | run/format failure | task-quality path: corrected `--flash` retry |
| 4 | auth failure | infra: re-auth, re-dispatch same prompt |
| 5 | folder trust rejected | infra: re-run with `--trust`, re-dispatch |
| 124 | wrapper timeout | infra: raise `--timeout` or split the task, re-dispatch |

Infra failures (4/5/124) never consume the corrected retry and never escalate to Claude by themselves.
