# orchestrate-personal

Router skill for the personal machine, where two ~$100 quota-limited subscriptions coexist: Anthropic (Claude Code, native) and OpenAI (Codex, via `openai/codex-plugin-cc`). Routes each task to the executor with the best quality-price fit using a deterministic table (judgment only for gray cases), adapts prompts to Codex's style before dispatch, balances load across both quotas, and logs every decision to `~/.orchestrator/`. Happy path for verified routine work: zero judge tokens, zero review tokens.

> Looking for the model-facing contract? See [`SKILL.md`](./SKILL.md).

## Requires

- `openai/codex-plugin-cc` plugin (`/codex:review`, `/codex:rescue`, `/codex:adversarial-review`, …)

## Install

```bash
npx behagoras-skills install orchestrate-personal
```
