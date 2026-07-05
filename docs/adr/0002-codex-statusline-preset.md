# ADR 0002: Codex Status-Line Preset

## Status

Accepted

## Context

Prompt 665 added a Claude Code status-line plugin. Claude Code supports a command-backed `statusLine` setting that runs a script, receives session JSON on stdin, and can render arbitrary terminal output.

Codex CLI exposes a different API. As of the 2026-07-05 research pass, the official `/statusline` docs say the TUI picker toggles and reorders built-in footer items and persists them to `tui.status_line` in `config.toml`. The config schema exposes `tui.status_line: string[]` and `tui.status_line_use_colors: boolean`.

Source review in `openai/codex` confirmed the same model:

- `codex-rs/tui/src/bottom_pane/status_line_setup.rs` defines the built-in `StatusLineItem` enum.
- `codex-rs/tui/src/chatwidget/status_surfaces.rs` parses configured IDs, warns once for invalid IDs, skips unavailable values, and renders built-in segments.
- `codex-rs/config/src/types.rs` and `codex-rs/core/config.schema.json` define `status_line` and `status_line_use_colors`.

No documented or source-backed command execution hook exists for Codex status-line rendering today.

Local verification during this work:

- `codex --version`: `codex-cli 0.125.0`
- `npm view @openai/codex version dist-tags --json`: latest `0.142.5`, alpha `0.143.0-alpha.36`

## Decision

Ship a Codex-native plugin named `codex-statusline` that packages:

- a Codex plugin manifest under `.codex-plugin/plugin.json`
- a skill that applies, audits, and reverts the preset
- a no-dependency config applicator for `$CODEX_HOME/config.toml` or `~/.codex/config.toml`
- a print-only helper for the recommended TOML block
- tests for safe line-oriented TOML editing

The preset uses only known Codex IDs:

```toml
[tui]
status_line = [
  "model-with-reasoning",
  "context-used",
  "context-window-size",
  "five-hour-limit",
  "weekly-limit",
  "used-tokens",
  "git-branch",
  "pull-request-number",
  "branch-changes",
  "task-progress",
  "current-dir",
  "codex-version"
]
status_line_use_colors = true
```

## Consequences

The distribution is compatible with the real Codex CLI API and can be installed through a repo marketplace at `.agents/plugins/marketplace.json`.

The applicator is intentionally conservative: it creates a timestamped backup before modifying an existing config, preserves unrelated config, creates `[tui]` if missing, and replaces only `status_line` and `status_line_use_colors` inside `[tui]`.

Codex status-line items without data are omitted temporarily by Codex. This is expected for PR number, branch changes, rate limits, token data, and task progress when those values are unavailable.

Current limitations remain:

- no custom command-backed renderer
- no arbitrary ANSI segment rendering
- no custom 10-character progress bar
- no built-in cost or duration item
- rate-limit items show remaining percentage, not used percentage

If Codex later documents a command-backed status-line hook or adds cost/duration/progress items, this plugin should be updated and this ADR amended or superseded.
