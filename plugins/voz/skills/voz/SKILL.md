---
name: voz
description: Voice mode for this conversation. Use when the user asks to turn voice mode (modo voz, audio replies) on or off, to check it, or to delete its stored audio.
---

# voz

Voice mode ends each reply with an audio summary. It stays off until the user asks for it, and it covers one conversation: one T3 Code thread, or one agent session outside T3 Code.

The CLI ships with this plugin at `scripts/voz.mjs`, two folders above this file. Pass `--harness` with the agent you run in: `claude` for Claude Code, `codex` for Codex, `antigravity` for Antigravity.

| The user asks to | Command |
|---|---|
| turn voice mode on | `node <plugin>/scripts/voz.mjs on --harness <agent>` |
| turn voice mode off | `node <plugin>/scripts/voz.mjs off --harness <agent>` |
| check voice mode | `node <plugin>/scripts/voz.mjs status --harness <agent>` |
| see stored audio | `node <plugin>/scripts/voz.mjs list` |
| delete this conversation's audio | `node <plugin>/scripts/voz.mjs clean --current --harness <agent>` |
| delete audio older than N days | `node <plugin>/scripts/voz.mjs clean --days N` |
| delete all audio | `node <plugin>/scripts/voz.mjs clean --all`, after the user confirms |

## Steps

1. Run the command from the table. Done when it prints its result.
2. Relay the result in the user's language. After `on`, tell the user each point the output lists, then copy its `![Audio](...)` line as the last line of your reply. Done when that line closes the reply.

While voice mode is on, the plugin's hook gives each later reply its own `![Audio](...)` line. Close every reply with it the same way.
