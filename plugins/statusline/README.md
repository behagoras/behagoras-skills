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

Enable the status line:

```text
/statusline:enable
```

Claude Code v2.1.201 does not apply top-level `statusLine` from plugin `settings.json`; its plugin settings currently support only `agent` and `subagentStatusLine`. The enable command copies the renderer to `~/.claude/statusline-behagoras.mjs`, backs up `~/.claude/settings.json`, and writes the user-level `statusLine` that Claude Code reads.

If `~/.claude/settings.json` already has a user-level `statusLine`, the enable command replaces it after writing a timestamped backup.

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
