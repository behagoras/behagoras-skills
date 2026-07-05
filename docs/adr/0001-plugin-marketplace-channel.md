# ADR 0001: behagoras-skills doubles as a Claude Code plugin marketplace

## Status

Accepted

## Context

`behagoras-skills` already distributes Claude Code skills through an npm package and CLI installer. That channel remains useful for symlinking skill directories, slash commands, and skill-specific configuration into `~/.claude/`.

Claude Code plugins have a native marketplace mechanism with `.claude-plugin/marketplace.json`, plugin manifests, and `/plugin marketplace add`. Plugins are installed and updated by Claude Code itself, and may ship plugin-specific settings and other components.

## Decision

The repository now has two distribution channels:

- npm package and `behagoras-skills` CLI for skills.
- Claude Code plugin marketplace for plugins.

Plugins live under `plugins/` and are listed in `.claude-plugin/marketplace.json`. The npm CLI is not extended to install plugins.

## Consequences

Users install skills with `npx behagoras-skills install` and plugins with `/plugin marketplace add behagoras/behagoras-skills` followed by `/plugin install <plugin>@behagoras-skills`.

The repo documentation must keep those channels distinct. Plugin install behavior, validation, caching, and updates belong to Claude Code's plugin system, not to the npm CLI.
