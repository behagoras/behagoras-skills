# Routing table — personal machine (Claude + Codex)

Derived from the strengths matrix in `/Users/Shared/chimera-workspace/fable-tasks/09-model-strengths-and-prompting.md` (July 2026). Rankings shift monthly — re-verify against doc 09 before changing rows, and update doc 09 first if reality has moved.

**Tiers.** Codex: `spark` (~1000 tok/s, trivial/mechanical), `mini` (cheap passes), default `--effort medium` (interactive), `--effort high` (hard). Claude: Sonnet (default), Opus (correctness-critical work, arbitration).

| Task pattern | Target | Tier | Verification | Escalation trigger |
| --- | --- | --- | --- | --- |
| Code review (a diff/PR not authored by Claude) | Codex `/codex:review` | medium | The review report itself — no meta-review | Report flags a correctness-critical defect → Claude confirms before blocking the PR |
| Code review (of Claude's own output) | Codex `/codex:adversarial-review --background` | medium | The adversarial report | Reviewer and author disagree → Claude arbitrates |
| Bug investigation | Codex `/codex:rescue --background` | medium (`high` if a prior attempt failed) | Failing repro test turns green | No root cause after one `--resume` → Claude takes over natively |
| Test writing | Codex | `mini` (`spark` for pure boilerplate) | Tests pass AND fail when the target code is intentionally broken | Tautological or flaky tests → Claude rewrites them |
| Refactor (multi-file) | Claude | Sonnet; Opus if architectural / cross-cutting | Full suite green + lint clean | Suite still red after one retry, or scope grows past the named files → David |
| Correctness-critical code (auth, payments, data migrations, prod config) | Claude | Opus | Tests + `/codex:adversarial-review --background` | Any reviewer disagreement → Claude arbitrates; unresolved → David |
| Docs (technical, English) | **either** — gray, step 2 decides via quota balance | Codex `mini` / Claude Sonnet | Renders cleanly, links resolve; David skims | Business/persona content (Mexican Spanish) → always Claude |
| Spec / prompt creation (create-prompt) | Claude | Sonnet; Opus for strategic specs | Spec follows create-prompt structure; grill-with-docs for strategic ones | Grilling surfaces unresolved ambiguity → David decides |
| Background delegation (long-running, terminal-heavy, batch sweeps) | Codex `--background` | medium; `mini`/`spark` for mechanical sweeps | The task's own automatic checks; `/codex:status` → `/codex:result` | Stalled or errored after one `--resume` → Claude native |

## Why these defaults

- Codex leads terminal/agentic speed and cheap fast passes; its background job system (status/result/resume) keeps job state out of Claude's context — so delegation, investigation, and mechanical work default there.
- Claude leads multi-file refactors, correctness-critical code, instruction-following in long prompts, and structured writing — so refactors, critical code, and spec writing stay native.

## Gray cases

Gray = no row matches, two rows conflict, or the matched row says "either". Only gray cases earn the SKILL.md step-2 judgment pass; everything else routes at zero reasoning cost.
