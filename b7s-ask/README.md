# b7s-ask

Convert plain-text questions Claude just asked into a structured `AskUserQuestion` call — synthesizes 2-4 options per question from the conversation context and re-asks them via the selection UI. Useful when you'd rather click than type a freeform answer, or when Claude asked multiple parallel questions that benefit from the structured multi-question UI. Mexican-Spanish personal-use skill (adapts to English when the conversation has been in English). Does not invent new questions — only reformats the ones Claude already wrote.

> Looking for the model-facing contract? See [`SKILL.md`](./SKILL.md).

## Install

```bash
npx behagoras-skills install b7s-ask
```
