# Routing table (work machine: Gemini free, Claude metered)

Single source of truth for routes. Match the task to exactly one row, top to bottom — earlier rows win. Grounded in `fable-tasks/09-model-strengths-and-prompting.md` (strengths matrix, July 2026 — re-verify before major routing changes).

| # | Task shape | Route | Conditions / notes |
|---|-----------|-------|--------------------|
| 1 | **Anything web-shaped**: internet search, doc lookup, "what's the latest X", library/API versions, news, any question needing live or current information | `/gemini:search` | **Mandatory, zero exceptions.** Claude has no web access on this machine, and Gemini's Google grounding with citations is better anyway. |
| 2 | **Safety-floor tasks**: touches secrets/env files, irreversible operations, side-effecting external actions (git pushes, API calls with side effects, anything leaving the machine) | Claude review or David's approval — **never `--yolo`** | Overrides every row below. Gemini may still do read-only prep work (row 3), but the write/side-effect itself needs Claude or David. |
| 3 | **Read-only cognition**: analysis, audits, summaries, codebase questions, multimodal inputs (images, PDFs, video), frontend from mockups/screenshots | `/gemini:delegate --read-only` | Default delegate mode. Multimodal and visual work are Gemini strengths (doc 09). |
| 4 | **Verified implementation**: test writing, routine implementation, repetitive workflow steps | `/gemini:delegate` (writes allowed) | ONLY when automatic verification exists — tests, lint, schema validation. No automatic verification → treat as row 3 (Gemini drafts read-only, Claude or David applies) or row 6 if correctness-critical. |
| 5 | **Bulk/simple subtasks** and **corrected retries** | `/gemini:delegate --flash` | Cheap/fast tier. All first retries after a Gemini failure go here (see retry policy in SKILL.md), never to Claude. |
| 6 | **Claude-reserved work**: routing gray cases, correctness-critical code, multi-file refactors, long agentic chains (~12+ tool calls with state between them), arbitration when reviews disagree, final judgment on ambiguous quality | Claude | Gemini improved 2x over 2.5 on long chains but still drifts before Claude does (doc 09) — route these to Claude, or delegate pieces to Gemini under Claude supervision. |

## Gray cases

A task that fits no row cleanly is itself Claude work (row 6): make the call, then log the pattern in `~/.orchestrator/memory-work.jsonl` so the next occurrence is a table hit, not a judgment call. If a task spans rows, split it: web parts → row 1, read-only prep → row 3, the judgment core → row 6.

## Escalation (from SKILL.md retry policy)

Failed Gemini attempt → one corrected retry via `--flash` (row 5) → second failure → Claude (row 6) with summarized failure context. Escalations still log a memory line with `outcome: "escalated"`.
