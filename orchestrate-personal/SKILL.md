---
name: orchestrate-personal
description: Route work on the personal machine between Claude and Codex for the best quality-price fit across both quotas. Use when David asks to run a task or saved prompt without naming which model, wants work delegated to the background, asks which model should handle something, or when one model's output needs review by the other. Also reached by run-prompt before executing a spec.
---

# orchestrate-personal

The personal machine pays two ~$100 quota-limited subscriptions: Anthropic (Claude Code, native execution) and OpenAI (Codex, via the `openai/codex-plugin-cc` plugin: `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`, `/codex:status`, `/codex:result`, `/codex:cancel`; flags `--model gpt-5.x-mini|spark`, `--effort`, `--background`, `--resume`). This skill routes each task to the executor with the best quality-price fit, adapts the prompt to the target's style, and keeps both quotas draining evenly.

Root rule: **table first, judgment second**. The routing table decides obvious cases at zero reasoning cost; only gray cases earn a judgment pass. Happy path for a routine, automatically verified task = one Claude touchpoint (this routing turn), 0 judge tokens, 0 review tokens.

## Procedure

### 1. Classify

Match the task against the table in [references/routing-table.md](references/routing-table.md) — read it now if it is not already in context.
Done when: exactly one row matches, or the task is declared **gray** (no row matches, two rows conflict, or the matched row says "either").

### 2. Judge — gray cases only

One short inline reasoning pass. No subagent, no exploration. Tie-breakers in order:

1. **Verifiability** — cheap automatic verification exists (tests / lint / schema / render check) → Codex; verifying would cost as much as doing it → Claude.
2. **Correctness stakes** — production, user-facing, irreversible, or touching money/auth/data → Claude.
3. **Quota balance** — tail the last ~20 lines of `~/.orchestrator/usage-personal.jsonl`; route to the less-consumed provider.

Done when: route + tier chosen, with a one-line rationale that will go in the memory log.

### 3. Adapt the prompt

Codex-bound: rewrite the spec per [references/codex-adapter.md](references/codex-adapter.md) — read it before every Codex dispatch. Claude-bound: pass through unchanged (create-prompt specs are Claude-flavored by default).
Done when: every adapter checklist item is marked applied or n/a (Codex), or the spec is confirmed untouched (Claude).

### 4. Dispatch

- **Codex**: issue the `/codex:*` command from the table row with the tier's `--model`/`--effort` flags. Prefer `--background` for anything longer than a few minutes — the job's state then lives in Codex, not in this context. Poll with `/codex:status`, collect with `/codex:result`, continue a stalled job once with `--resume`.
- **Claude**: execute natively — main thread for small work, subagents for parallelizable work, a worktree for feature work (worktree discipline in the workspace `CLAUDE.md`).

Done when: the command is issued or native execution has started.

### 5. Verify — cross-review, never self-review

Apply the matched row's verification column:

- Automatic verification exists → run it. Pass = done; no model reviews anything.
- Codex output with **no** automatic verification → Claude reviews the diff.
- Claude output, correctness-critical → `/codex:adversarial-review --background`.
- Reviewers disagree → Claude arbitrates. This is the only case where Claude judges output it is close to.

Done when: the result is recorded as pass, fail (→ fire the row's escalation trigger), or escalated.

### 6. Log

Append one line to each file (`mkdir -p ~/.orchestrator` on first use; both files live outside every git repo):

- `~/.orchestrator/usage-personal.jsonl` — `{"ts","provider","tier","est_tokens","task_type"}`
- `~/.orchestrator/memory.jsonl` — `{"ts","pattern","route","tier","adapter","verification","outcome","est_tokens"}`

`pattern` is a task category plus a ≤10-word sanitized summary. No secrets, no file contents, no full traces — the logs are for quota balance (step 2) and future routing calibration, nothing else.
Done when: both lines are appended.

## Integration

- Specs are written with **create-prompt**; when **run-prompt** executes a saved spec, run steps 1–3 first and let the routed model own the execution.
- Escalation from any row lands on Claude; a second failure lands on David, with the relevant `memory.jsonl` line as context.
