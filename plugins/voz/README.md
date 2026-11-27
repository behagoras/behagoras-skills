# Voz

Voice mode for Claude Code, Codex, and Antigravity. When it is on, each reply ends with an audio version, which macOS `say` reads into an `.m4a` file. In Claude Code, Haiku first rewrites the reply as a short spoken script. In Codex and Antigravity, the audio reads the reply's plain text. T3 Code shows the file as an audio player under the reply, about 10 seconds after the text.

Voice mode is off until you ask for it, and it covers one conversation.

## Install

Install the plugin in every agent you use. Voice mode only follows a T3 Code thread into agents that have it.

**Claude Code**

```text
/plugin marketplace add behagoras/behagoras-skills
/plugin install voz@behagoras-skills
```

**Codex**

```bash
codex plugin marketplace add behagoras/behagoras-skills
codex plugin add voz@behagoras
```

Codex asks you to review new hooks once. Open `/hooks` in Codex and trust the two `voz` hooks.

**Antigravity**

`agy plugin install` takes a local folder, so install from a clone:

```bash
git clone https://github.com/behagoras/behagoras-skills.git
agy plugin install behagoras-skills/plugins/voz
```

## Use

Ask the agent to "turn on voice mode" or to "activar el modo voz". You can also call the skill by name: `/voz:voz` in Claude Code, `$voz` in Codex, and `/voz` in Antigravity. Ask the same way to turn voice mode off, check it, or delete audio.

When voice mode turns on, the agent tells you how it behaves in this conversation. Each reply then ends with a line like `![Audio](/Users/you/.local/share/voz/conversations/t3-…/20261124-155546-0a494b.m4a)`. The file appears a few seconds after the reply.

## How it works

The plugin has a skill, two hooks, and one Node script, `scripts/voz.mjs`.

1. The skill runs `voz.mjs on`. The script records that voice mode is on and gives the agent this reply's audio path.
2. Before each later turn, a hook gives the agent a new audio path and asks it to end the reply with that path as a Markdown image line.
3. After each turn, a hook checks that the reply holds the path. It then starts a background worker and returns at once.
4. In Claude Code, the worker asks Haiku for a spoken script of at most 120 words, in the reply's language. In Codex and Antigravity, it uses the reply's plain text. It writes the audio with `say` and adds a line to `index.jsonl`.

| Agent | Before the turn | After the turn | Audio text |
|---|---|---|---|
| Claude Code | `UserPromptSubmit` | `Stop`, which receives the reply | Haiku summary, medium effort, no tools |
| Codex | `UserPromptSubmit` | `Stop`, which receives the reply | Plain text of the reply |
| Antigravity | `PreInvocation`, first invocation of the turn | `Stop`; the worker reads the reply from the transcript | Plain text of the reply |

Plain text drops code, tables, and links, and stops at about 1,500 characters. Claude Code also falls back to it when Haiku fails or takes more than 90 seconds.

Codex and Antigravity have no way to turn off their tools in a summarizer run, so a model could act on instructions quoted in a reply. Their audio skips the model.

### One conversation, several agents

Inside T3 Code, the plugin keys voice mode on `T3CODE_THREAD_ID`. A T3 thread keeps that id when you switch provider, so voice mode stays on after a handoff from Claude Code to Codex or Antigravity. Outside T3 Code, the key is the agent's own session id.

An agent that another agent starts, such as `codex exec` run from Claude Code, inherits the thread id. The hooks tell the two apart by process: each turn records the process id of the agent that owns the conversation. A session whose process descends from the owner's process was started by the owner, so its hooks do nothing. Any other session is a provider switch, or the owner has exited, so it takes over. This also covers a turn you interrupt and then hand off.

The Haiku summarizer runs with `VOZ_INNER=1`, which turns every `voz` hook into a no-op, and with `--tools ""`, so it has no tools.

### Sandboxes

Codex runs commands in a sandbox that can only write to the project and temp folders. When `voz.mjs on` or `off` cannot write the state folder, it leaves the change in `/tmp/voz-<uid>/`, a folder only you can write to. The next hook runs outside the sandbox and applies the change when the reply ends.

## Storage and cleanup

```text
~/.local/share/voz/
  index.jsonl                 one line per audio file: date, conversation, agent, session, folder, file
  voz.log                     errors, and every hook call when VOZ_DEBUG is set
  conversations/
    t3-<thread id>/           a T3 Code thread
    claude-<session id>/      an agent session outside T3 Code
      state.json              on or off, owning session, pending audio path
      20261124-155546-0a494b.m4a
```

When a turn ends, the hook deletes audio older than 14 days, at most once every 6 hours. It also deletes conversation folders that hold no audio and have voice mode off, or that have been idle for 14 days.

To clean by hand, ask the agent, or run the script:

```bash
node plugins/voz/scripts/voz.mjs list                         # conversations with audio
node plugins/voz/scripts/voz.mjs clean                        # audio older than 14 days
node plugins/voz/scripts/voz.mjs clean --days 3               # audio older than 3 days
node plugins/voz/scripts/voz.mjs clean --conversation t3-<id> # one conversation
node plugins/voz/scripts/voz.mjs clean --all                  # everything
```

## Settings

| Variable | Default | Effect |
|---|---|---|
| `VOZ_HOME` | `~/.local/share/voz` | Where state, audio, and the index live |
| `VOZ_VOICE` | `Paulina` | macOS voice. `say -v '?'` lists the voices |
| `VOZ_RATE` | `185` | Words per minute |
| `VOZ_RETENTION_DAYS` | `14` | Age at which audio is deleted |
| `VOZ_DEBUG` | unset | Log every hook call to `voz.log` |

## Requirements

- macOS, for `say`.
- Node.js 18 or later.
- For Claude Code summaries, `claude` on `PATH`. Without it, the audio reads the reply's plain text.

## Tests

```bash
node --test plugins/voz/scripts/voz.test.mjs
```

The tests put fake `say`, `claude`, `codex`, and `agy` commands on `PATH` and check activation, handoff, nested agents, the Antigravity transcript, the sandbox spool, the plain-text fallback, and cleanup.
