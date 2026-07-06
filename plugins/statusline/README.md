# Statusline

Custom Claude Code status line showing the active model, context-window usage, session cost and duration, and subscription rate limits when Claude Code provides them.

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
[Opus] | ███░░░░░░░ 34% | $1.23 | 45m 12s | 5h: 23% 7d: 41%
```

Narrow terminals split the status over two rows:

```text
[Opus] | ███░░░░░░░ 34%
$1.23 | 45m 12s | 5h: 23% 7d: 41%
```

Screenshot placeholder:

```text
TODO: Add screenshot after the first marketplace install smoke test.
```
