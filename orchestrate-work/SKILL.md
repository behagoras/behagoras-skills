---
name: orchestrate-work
description: Route work-machine tasks between free Gemini and metered Claude to cut Claude token spend. Use when a task needs anything from the web (Claude has no web access on this machine), when delegating analysis, tests, or routine implementation to Gemini as the cheap executor, when deciding how to review or close a Gemini result, or when a Gemini attempt failed and escalation to Claude is in question.
---

# orchestrate-work

On this machine Gemini is unlimited and free (enterprise); Claude is **metered** — the boss's experiment measures Claude tokens saved per task. So Gemini is the default executor for everything it can reliably complete, and Claude is the scarce resource you spend only where judgment or correctness demands it. Every routed task gets logged so the savings are provable, not vibes.

**First-use gate:** before the very first Gemini dispatch, confirm with David what work content the enterprise data policy allows sending to Gemini. Do not dispatch until confirmed.

Two invariants override every other consideration:

- **Web invariant.** Claude has NO web access here. Any task shaped like web research — search, doc lookup, "what's the latest X", anything needing live/current information — routes to `/gemini:search`. Zero exceptions.
- **Safety floor.** Never `--yolo` for changes touching secrets/env files, irreversible operations, or side-effecting external actions (pushes, API calls that leave the machine). Those require Claude review or David's explicit approval, regardless of how routine the task looks.

## Process

### 1. Route

Read [references/routing-table.md](references/routing-table.md) and match the task to exactly one row. Gray case (fits no row cleanly)? That IS a Claude task — deciding is the judgment work Claude is reserved for; decide, then record the pattern in the log so next time it's a table hit.

Done when: the chosen route names a table row (or is an explicit gray-case decision); no web-shaped task is routed anywhere but `/gemini:search`; write access (`--yolo`) is granted only with automatic verification available AND the safety floor clear.

### 2. Adapt the prompt

Gemini prompts are not Claude prompts — create-prompt specs are Claude-flavored and must be rewritten before dispatch. Apply every item in [references/gemini-adapter.md](references/gemini-adapter.md) (instructions at the end, labeled inputs, no broad negatives, etc.).

Done when: every checklist item is applied or explicitly N/A for this task.

### 3. Dispatch and verify

Dispatch on the chosen route, via the **direct path by default**: launch `gemini-run.mjs` in background Bash and follow the live per-run log — zero subagent cost. Launch the `gemini-executor` subagent ONLY when the output will be huge and must be summarized away from the main context; its launch itself spends Claude tokens (charge them in step 5). Mechanics, exit codes, and field workarounds: [references/dispatch-notes.md](references/dispatch-notes.md). Prefer `--read-only` unless writes are the point of the task. If automatic verification exists (tests, lint, schema), run it immediately after.

**Triage the failure class before retrying — infra failures don't burn the retry:**
- Exit 4 (auth), 5 (folder trust), or 124 (timeout) → environment problem, not a prompt problem. Fix it (re-auth, `--trust`, raise `--timeout`) and re-dispatch the SAME prompt. Costs no retry and never escalates to Claude by itself.
- Task-quality failure (wrong/incomplete output, verification red) → retry policy below.

**Retry policy — Gemini failures stay cheap:**
- First failure → draft ONE corrected prompt (fix what the failure revealed: missing label, buried instruction, wrong anchor) and retry via `/gemini:delegate --flash`. Do not spend Claude on the correction.
- Second failure → escalate to Claude, passing a *summarized* failure context (task, what was tried, error/verification output) — never the raw transcript; the summary is what protects Claude's meter.

Done when: verification passes, or the task is escalated with a summary, or (no verification available) output is in hand for step 4.

### 4. Close or review

- **Verifiable task + verification green → closed.** No review, no Claude. This is the happy path and it must cost zero Claude judge tokens.
- **Non-verifiable output** → `/gemini:adversarial` self-red-team first. Claude reviews only if the adversarial pass flags issues or quality remains genuinely ambiguous after it.

Done when: the task is closed by verification, closed by a clean adversarial pass, or handed to Claude with the adversarial findings attached.

### 5. Log the savings

Append one JSONL line to `~/.orchestrator/memory-work.jsonl` for EVERY routed task — successes, retries, escalations, all of it. Schema, savings formula, and token heuristics: [references/savings-report.md](references/savings-report.md). Include the run's `~/.gemini-runs/` directory in the line and count any `gemini-executor` launch as Claude spend — the run artifacts make the boss's numbers auditable. This log IS the boss's experiment; an unlogged task is a saving that never happened.

Weekly report for the boss: `python3 scripts/weekly_report.py` (in this skill's folder).

Done when: the line is appended and includes a `claude_tokens_avoided` estimate.
