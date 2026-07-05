# Codex Status Line

Codex CLI status-line preset for operational session telemetry: model and reasoning, context remaining, 5-hour quota remaining, token usage, git and PR state, task progress, current directory, and Codex version.

Codex CLI does not currently expose Claude Code's command-backed `statusLine` API. This plugin uses Codex's native `tui.status_line` config instead.

Codex also renders `tui.status_line` as a single footer row. This plugin cannot force a second status row until Codex supports multi-line footers or an external status-line renderer. The desired two-line layout is tracked in [`docs/codex-statusline/upstream-gap.md`](../../docs/codex-statusline/upstream-gap.md).

## Install With `/plugins`

Clone this repository and open Codex from the repo root:

```bash
git clone https://github.com/behagoras/behagoras-skills.git
cd behagoras-skills
codex
```

Then open the plugin browser:

```text
/plugins
```

Select the `Behagoras` marketplace, install `codex-statusline`, then ask Codex:

```text
Use codex-statusline to apply the recommended status line.
```

The repo marketplace is defined at `.agents/plugins/marketplace.json` and points to `./plugins/codex-statusline`.

## Manual Apply

Print the recommended block without editing files:

```bash
node plugins/codex-statusline/scripts/print-codex-statusline-config.mjs
```

Apply the preset to `$CODEX_HOME/config.toml`, or `~/.codex/config.toml` when `CODEX_HOME` is unset:

```bash
node plugins/codex-statusline/scripts/apply-codex-statusline.mjs
```

Use a specific config path:

```bash
node plugins/codex-statusline/scripts/apply-codex-statusline.mjs --config /path/to/config.toml
```

Preview without writing:

```bash
node plugins/codex-statusline/scripts/apply-codex-statusline.mjs --dry-run
```

Restore a backup:

```bash
node plugins/codex-statusline/scripts/apply-codex-statusline.mjs --revert ~/.codex/config.toml.bak-YYYYMMDD-HHMMSS
```

## Preset

```toml
[tui]
status_line = [
  "model-with-reasoning",
  "context-remaining",
  "five-hour-limit",
  "used-tokens",
  "context-window-size",
  "git-branch",
  "pull-request-number",
  "branch-changes",
  "task-progress",
  "current-dir",
  "codex-version"
]
status_line_use_colors = true
```

Items with no data are temporarily omitted by Codex. For example, PR number and branch changes require git metadata, rate limits require usage data, and task progress appears only after checklist progress exists.

Codex's compact rate-limit labels are ambiguous in the footer. Treat `5h N%` as Codex's built-in 5-hour quota snapshot, and use `/status` for the authoritative breakdown and reset time. `weekly-limit` is supported by Codex, but it is intentionally not in this default preset so the footer emphasizes what remains in the current working session.

## Safety

`apply-codex-statusline.mjs`:

- creates a timestamped backup before modifying an existing config
- preserves unrelated config
- creates `[tui]` when missing
- replaces only `status_line` and `status_line_use_colors` inside `[tui]`
- validates the preset against the local Codex status-line ID list before writing
- supports `--dry-run`, `--print`, `--revert <backup-path>`, and `--config <path>`
