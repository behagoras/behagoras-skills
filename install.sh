#!/usr/bin/env bash
# install.sh — Node-bootstrap fallback for behagoras-skills.
#
# The supported install path is:
#   npx behagoras-skills install
#
# This script exists so a freshly cloned repo without a globally available
# `npx behagoras-skills` shortcut still has a working entry point. It will:
#   1. Verify Node.js >= 18 is on PATH.
#   2. Run `npx behagoras-skills@latest install <args>` (delegates to the CLI).
#   3. If Node is missing, print install hints and exit nonzero.

set -euo pipefail

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  cat >&2 <<'EOF'
behagoras-skills needs Node.js 18 or newer.

Install Node, then re-run `bash install.sh`:
  • macOS:        brew install node
  • Debian/Ubuntu: sudo apt install nodejs npm
  • Other:        https://nodejs.org/

Or — if you already have a global Node — invoke the CLI directly:
  npx behagoras-skills install
EOF
  exit 1
fi

NODE_VERSION="$("$NODE_BIN" -p 'process.versions.node')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if (( NODE_MAJOR < 18 )); then
  echo "Found Node $NODE_VERSION, but behagoras-skills requires Node 18+." >&2
  echo "Upgrade Node and re-run." >&2
  exit 1
fi

NPX_BIN="$(command -v npx || true)"
if [[ -z "$NPX_BIN" ]]; then
  echo "Node $NODE_VERSION is installed but npx is missing." >&2
  echo "Install npm (it ships with Node), then re-run." >&2
  exit 1
fi

exec "$NPX_BIN" -y behagoras-skills@latest install "$@"
