# Savings log & weekly report

The metric for the boss's experiment: **Claude tokens avoided** per routed task, accumulated weekly. Log lives at `~/.orchestrator/memory-work.jsonl` (append-only JSONL, outside any repo). Create the directory on first use: `mkdir -p ~/.orchestrator`.

## Schema — one line per routed task

```json
{
  "ts": "2026-07-06T10:42:00Z",
  "task": "sanitized one-line task summary (no secrets, no client data)",
  "pattern": "web-search | codebase-analysis | impl-verified | bulk | multimodal | gray-case | ...",
  "route": "gemini:search | gemini:delegate-ro | gemini:delegate | gemini:delegate-flash | claude",
  "tier": "pro | flash | claude",
  "retries": 0,
  "outcome": "success | escalated | failed",
  "est_claude_only_tokens": 20000,
  "claude_tokens_spent": 500,
  "claude_tokens_avoided": 19500,
  "run_dir": "~/.gemini-runs/20260706-104200-task-slug"
}
```

Field rules:

- `task` is sanitized — a pattern-level summary, never verbatim work content (the log may be shown around).
- `pattern` is free-form but reuse existing values (grep the file first) so weekly grouping stays meaningful; new patterns from gray-case decisions get a new value.
- `retries` counts Gemini retries (0 or 1 under the retry policy).
- Escalated tasks log `route` as the original Gemini route with `outcome: "escalated"` — the savings math below captures the Claude spend.

## Savings formula

```
claude_tokens_avoided = est_claude_only_tokens − claude_tokens_spent
```

- **`est_claude_only_tokens`** — what a Claude-only execution would have consumed (input + output + tool round-trips). Estimate with size classes unless you have a better basis (e.g., a comparable past task in this log):
  - **S** ≈ 5,000 — single question, small file, short answer
  - **M** ≈ 20,000 — multi-file read, analysis, or a small implementation with tests
  - **L** ≈ 60,000 — cross-cutting analysis, medium implementation, several verification cycles
  - **XL** ≈ 150,000 — large refactor-scale work (these usually route to Claude anyway, so avoided ≈ 0)
  - Web-search tasks: estimate the tokens Claude would burn working around its missing web access (answering from stale knowledge + digesting pasted results) — typically S.
- **`claude_tokens_spent`** — Claude tokens actually used on this task: routing/adapting overhead (usually small), any escalation execution, any Claude review, and **any `gemini-executor` launch (~15-30k input tokens per launch)** — the direct path avoids this cost entirely, which is why it's the default. Claude-route tasks spend ≈ everything, so `avoided ≈ 0` — that's honest and keeps the metric credible.
- **`run_dir`** — the task's `~/.gemini-runs/` directory (omit for Claude-route tasks). Its `meta.json` (status, duration, model) is the audit trail behind the estimate: anyone checking the weekly numbers can sample log lines against real run artifacts.

Estimates are heuristics, not billing data — keep them consistent week to week so the trend is real even if the absolute numbers are rough.

## Weekly report

```bash
python3 <this-skill-folder>/scripts/weekly_report.py            # last 7 days
python3 <this-skill-folder>/scripts/weekly_report.py --days 30  # custom window
```

Outputs: tasks routed, % Gemini-only (no Claude escalation/review), estimated Claude tokens saved, and a per-route breakdown — the numbers David shows his boss.
