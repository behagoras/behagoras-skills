# Routing table (work machine: Gemini free, Claude metered)

Single source of truth for routes. Match the task to exactly one row, top to bottom — earlier rows win. Grounded in `fable-tasks/09-model-strengths-and-prompting.md` (strengths matrix, July 2026 — re-verify before major routing changes).

| # | Task shape | Route | Conditions / notes |
|---|-----------|-------|--------------------|
| 1 | **Anything web-shaped**: internet search, doc lookup, "what's the latest X", library/API versions, news, any question needing live or current information | `/gemini:search` | **Mandatory, zero exceptions.** Claude has no web access on this machine, and Gemini's Google grounding with citations is better anyway. |
| 2 | **Safety-floor tasks**: touches secrets/env files, irreversible operations, side-effecting external actions (git pushes, API calls with side effects, anything leaving the machine) | Claude review or David's approval — **never `--yolo`** | Overrides every row below. Gemini may still do read-only prep work (row 3), but the write/side-effect itself needs Claude or David. |
| 3 | **Read-only cognition**: analysis, audits, summaries, codebase questions, multimodal inputs (images, PDFs, video), frontend from mockups/screenshots | `/gemini:delegate --read-only` | Default delegate mode. Multimodal and visual work are Gemini strengths (doc 09). |
| 4 | **Verified implementation**: test writing, routine implementation, repetitive workflow steps | `/gemini:delegate` (writes allowed) | ONLY when automatic verification exists — tests, lint, schema validation. No automatic verification → treat as row 3 (Gemini drafts read-only, Claude or David applies) or row 6 if correctness-critical. |
| 5 | **Bulk/simple subtasks** and **corrected retries** | `/gemini:delegate --flash` | Cheap/fast tier. All first retries after a Gemini failure go here (see retry policy in SKILL.md), never to Claude. |
| 6 | **Medium chains, observable**: multi-step but bounded work (~5-12 tool calls) where drift is the only worry, not correctness stakes | `/gemini:delegate` **supervised by live log** | Follow the run's `~/.gemini-runs/<run>/run.log` (`--stream`); kill on first drift and escalate. `--timeout` as backstop. This row exists because live logs made supervision nearly free — before it, these tasks went straight to row 7. |
| 7 | **Claude-reserved work**: routing gray cases, correctness-critical code, multi-file refactors, long agentic chains (~12+ tool calls with state between them), arbitration when reviews disagree, final judgment on ambiguous quality | Claude | Gemini improved 2x over 2.5 on long chains but still drifts before Claude does (doc 09) — route these to Claude, or delegate pieces to Gemini under Claude supervision. |

## Gray cases

A task that fits no row cleanly is itself Claude work (row 7): make the call, then log the pattern in `~/.orchestrator/memory-work.jsonl` so the next occurrence is a table hit, not a judgment call. If a task spans rows, split it: web parts → row 1, read-only prep → row 3, the judgment core → row 7.

## Dispatch mode (applies to rows 3-6)

Default = **direct path**: background Bash of `gemini-run.mjs`, follow the live log — no subagent, no Claude token overhead. Launch `gemini-executor` only for huge-output runs whose result must be summarized away from the main context; its launch costs Claude tokens that count against the savings metric. Details: [dispatch-notes.md](dispatch-notes.md).

## Escalation (from SKILL.md retry policy)

Infra failures (exit 4 auth / 5 trust / 124 timeout) → fix environment, re-dispatch same prompt, no retry burned. Task-quality failure → one corrected retry via `--flash` (row 5) → second failure → Claude (row 7) with summarized failure context. Escalations still log a memory line with `outcome: "escalated"`.
