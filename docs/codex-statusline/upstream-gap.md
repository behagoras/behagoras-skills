# Codex Status-Line Upstream Gap

## Desired Layout

The target Behagoras footer is two lines of content:

```text
gpt-5.3-codex-spark medium | ctx 100% left / 272k | tokens 12.4k | v0.142.5
5h 17% left | feat/codex-statusline-plugin | PR #15 | +12 -3
```

Line 1 should focus on session/runtime state. Line 2 should focus on what remains in the current working session plus workspace state. Weekly quota can remain available through `/status` or an optional footer item, but it should not dominate the default session-focused layout.

## Current Codex Limitation

Codex CLI currently exposes `tui.status_line` as an ordered list of built-in item IDs. The TUI renders those items into one footer row. There is no documented configuration for:

- two footer rows
- explicit line breaks between status-line segments
- custom labels for built-in items
- command-backed status-line rendering
- arbitrary ANSI or progress-bar output

Because of that, `codex-statusline` can install a useful single-row preset but cannot produce the requested two-line layout without upstream support in Codex.

## Related Upstream Requests

- Multi-line status line: https://github.com/openai/codex/issues/21653
- External command-backed renderer: https://github.com/openai/codex/issues/20043
- Ambiguous `5h` / `weekly` labels: https://github.com/openai/codex/issues/24274
- Quota reset/status details: https://github.com/openai/codex/issues/24080

## Local Workaround

Use the native preset for now and rely on `/status` when the compact quota labels are ambiguous. If Codex adds multi-line footer support or a command-backed renderer, this plugin should switch from a single `tui.status_line` preset to a richer layout with separate runtime and quota/workspace rows.
