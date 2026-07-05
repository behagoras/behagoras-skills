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

The plugin ships a default `statusLine` setting that runs:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ${CLAUDE_PLUGIN_ROOT}/statusline.mjs",
    "padding": 0
  }
}
```

If `~/.claude/settings.json` already has a user-level `statusLine`, that user setting overrides the plugin default. Delete or move the user-level entry to use this plugin's status line.

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
