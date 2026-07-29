# Statusline

Custom Claude Code status line showing the active model (with its reasoning effort), context-window usage with token counts, session cost and duration, and subscription rate limits when Claude Code provides them.

## Install

Add the Behagoras marketplace:

```text
/plugin marketplace add behagoras/behagoras-skills
```

Install the plugin:

```text
/plugin install statusline
```

If another marketplace also provides `statusline`, disambiguate with `/plugin install statusline@behagoras-skills`.

On session start, a `SessionStart` hook (`hooks/ensure-statusline.mjs`) writes the `statusLine` entry into `~/.claude/settings.json` for you, pointing at this plugin's script via the resolved `CLAUDE_PLUGIN_ROOT`. It re-runs on every session, so it self-heals if a plugin update changes the install path.

If `~/.claude/settings.json` already has a `statusLine` from another plugin or a manual entry, the hook leaves it alone — delete or replace that entry yourself to switch to this plugin's status line.

## Display

Wide terminals render one line:

```text
[Opus · high] | ███░░░░░░░ 34% (68k/200k) | $1.23 | 45m 12s | 5h: 23% 7d: 41%
```

Narrow terminals split the status over two rows:

```text
[Opus · high] | ███░░░░░░░ 34% (68k/200k)
$1.23 | 45m 12s | 5h: 23% 7d: 41%
```

The reasoning effort (`· high`) is shown when Claude Code reports `effort.level`, and the context token counts (`68k/200k`) when it reports `context_window.context_window_size`. Both are omitted gracefully when absent, so older Claude Code versions keep the original `[Opus] | ███░░░░░░░ 34%` layout.

Screenshot placeholder:

```text
TODO: Add screenshot after the first marketplace install smoke test.
```
