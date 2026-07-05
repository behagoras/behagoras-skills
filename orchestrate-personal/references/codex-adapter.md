# Codex prompt adapter checklist

Apply before every Codex dispatch. Source of truth: `/Users/Shared/chimera-workspace/fable-tasks/09-model-strengths-and-prompting.md`, section "→ Codex (GPT-5.x-Codex)". The rules below are quoted verbatim from it; if they ever drift, doc 09 wins — fix this file, not the dispatch.

## Rules (verbatim from doc 09)

- Start from OpenAI's default Codex prompt patterns; add snippets for autonomy/persistence, codebase exploration, tool use.
- **Remove** any instruction to communicate upfront plans, preambles, or status updates — these cause early stops.
- Reasoning effort `medium` for interactive work; bump for hard tasks; `mini`/`spark` for cheap passes.
- Bias-for-action language works well; keep XML structure (fine for both).

## Checklist (mark each item applied or n/a before dispatch)

Operationalizes the four rules above, in order:

- [ ] Removed every instruction to announce a plan, write a preamble, or post status updates mid-task.
- [ ] Added the autonomy/persistence snippet (below) so the job runs to completion unattended.
- [ ] Added the exploration/tool-use snippet (below) if the task touches code Codex has not seen.
- [ ] `--effort` set: `medium` default, `high` for hard tasks, `--model gpt-5.x-mini`/`spark` for cheap passes — matching the tier from the routing table row.
- [ ] Bias-for-action phrasing in the task statement ("fix", "implement", "make the test pass" — not "consider", "propose").
- [ ] XML structure of the create-prompt spec preserved.

Router-specific additions (not from doc 09, but required for a clean dispatch):

- [ ] Stripped references Codex cannot act on: Claude subagents, Claude Code skills, `/` commands, workspace-only conventions.
- [ ] Success criteria in the spec are checkable by Codex itself (a command to run, a test to pass) — background jobs cannot ask questions.

## Snippets

Autonomy/persistence:

> You are an autonomous agent. Keep going until the task is completely resolved before ending your turn. Never stop at uncertainty — research or infer the most reasonable approach and continue. Do not ask for confirmation; act on your best judgment.

Codebase exploration / tool use:

> Before editing, explore the relevant part of the codebase to understand existing structure and conventions. Use your tools to read files, search, and run commands rather than guessing. Verify your changes by running the project's tests or the commands given in the success criteria.
