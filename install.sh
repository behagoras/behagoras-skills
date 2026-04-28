#!/usr/bin/env bash
# install.sh — interactive installer for the behagoras-skills repo.
#
# Walks you through:
#   1. Symlink scope (global ~/.claude or no symlink)
#   2. Whether to drop a .transcriptsrc in the current directory
#   3. Which vault_dir to use in that .transcriptsrc
#   4. Verifying / installing system dependencies (yt-dlp, ffmpeg, mlx-whisper)
#
# Run from the root of your clone:
#   bash install.sh
#
# Non-interactive use is supported via env vars:
#   BSK_SCOPE=global|none
#   BSK_WRITE_RC=yes|no
#   BSK_VAULT_DIR=<path>
#   BSK_INSTALL_DEPS=yes|no

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$REPO_ROOT/video-transcript"
COMMANDS_DIR="$REPO_ROOT/commands"
SLASH_COMMANDS=(youtube-transcript instagram-transcript tiktok-transcript video-transcript)

if [[ ! -d "$SKILL_DIR" ]] || [[ ! -d "$COMMANDS_DIR" ]]; then
  echo "ERROR: this script must be run from the root of behagoras-skills." >&2
  echo "       expected: $SKILL_DIR and $COMMANDS_DIR" >&2
  exit 1
fi

bold()   { printf '\033[1m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
ask() {
  # ask "Question?" "default" — prints prompt, reads reply, echoes reply (or default if empty).
  local prompt="$1" default="${2:-}" reply
  if [[ -n "$default" ]]; then
    printf '%s [%s]: ' "$prompt" "$default" >&2
  else
    printf '%s: ' "$prompt" >&2
  fi
  read -r reply || true
  echo "${reply:-$default}"
}
ask_yes_no() {
  local prompt="$1" default="${2:-yes}" reply
  reply="$(ask "$prompt (yes/no)" "$default")"
  case "${reply,,}" in y|yes) return 0 ;; *) return 1 ;; esac
}

bold "behagoras-skills installer"
echo "Repo root: $REPO_ROOT"
echo

# ---------------------------------------------------------------------------
# 1) Symlink scope
# ---------------------------------------------------------------------------
bold "1) Where to install the skill and slash commands?"
echo "   global  — symlink into ~/.claude/skills/ and ~/.claude/commands/"
echo "             (recommended; Claude Code discovers them everywhere)"
echo "   none    — skip the symlinks, just configure things in this repo"
echo
SCOPE="${BSK_SCOPE:-$(ask "Scope (global / none)" "global")}"
case "$SCOPE" in
  global)
    mkdir -p "$HOME/.claude/skills" "$HOME/.claude/commands"
    if [[ -e "$HOME/.claude/skills/video-transcript" || -L "$HOME/.claude/skills/video-transcript" ]]; then
      yellow "  ~/.claude/skills/video-transcript already exists — leaving as-is."
    else
      ln -s "$SKILL_DIR" "$HOME/.claude/skills/video-transcript"
      green  "  linked: ~/.claude/skills/video-transcript -> $SKILL_DIR"
    fi
    for cmd in "${SLASH_COMMANDS[@]}"; do
      target="$HOME/.claude/commands/${cmd}.md"
      if [[ -e "$target" || -L "$target" ]]; then
        yellow "  ~/.claude/commands/${cmd}.md already exists — leaving as-is."
      else
        ln -s "$COMMANDS_DIR/${cmd}.md" "$target"
        green  "  linked: ~/.claude/commands/${cmd}.md"
      fi
    done
    ;;
  none)
    yellow "  Skipping symlinks. Run the script directly via:"
    echo  "    bash $SKILL_DIR/scripts/transcribe.sh <url>"
    ;;
  *)
    red "  Unknown scope '$SCOPE'. Aborting."; exit 2 ;;
esac
echo

# ---------------------------------------------------------------------------
# 2) .transcriptsrc in current directory
# ---------------------------------------------------------------------------
CWD="$(pwd -P)"
bold "2) Drop a .transcriptsrc in the current directory?"
echo "   Current directory: $CWD"
echo "   The skill will pick this up when invoked from this directory or"
echo "   any descendant. Useful for per-project transcript folders."
echo
WRITE_RC_DEFAULT="yes"
[[ -f "$CWD/.transcriptsrc" ]] && WRITE_RC_DEFAULT="no  (one already exists)"
WRITE_RC="${BSK_WRITE_RC:-$(ask "Create .transcriptsrc here?" "$WRITE_RC_DEFAULT")}"

if [[ "${WRITE_RC,,}" =~ ^(yes|y)$ ]]; then
  if [[ -f "$CWD/.transcriptsrc" ]]; then
    yellow "  $CWD/.transcriptsrc already exists — refusing to overwrite."
  else
    # ---- 3) vault_dir for the .transcriptsrc ----
    bold "3) Which vault_dir should this .transcriptsrc use?"
    echo "   Options:"
    echo "     ./.transcripts        — generated subfolder (gitignored by default)"
    echo "     ./spider              — David's pattern: vault lives at ./spider"
    echo "     <obsidian-autodetect> — search for a .obsidian directory under \$HOME"
    echo "     <custom>              — type any path; relative anchors to this .transcriptsrc"
    echo
    VAULT_CHOICE="${BSK_VAULT_DIR:-$(ask "vault_dir" "./.transcripts")}"
    if [[ "$VAULT_CHOICE" == "<obsidian-autodetect>" || "$VAULT_CHOICE" == "obsidian" ]]; then
      DETECTED="$(find "$HOME" -maxdepth 4 -type d -name '.obsidian' -not -path '*/.Trash/*' 2>/dev/null | head -1 | sed 's|/.obsidian$||')"
      if [[ -n "$DETECTED" ]]; then
        green "  Found Obsidian vault: $DETECTED"
        VAULT_CHOICE="$DETECTED"
      else
        yellow "  No Obsidian vault found under \$HOME; falling back to ./.transcripts"
        VAULT_CHOICE="./.transcripts"
      fi
    fi
    cat > "$CWD/.transcriptsrc" <<EOF
# .transcriptsrc — video-transcript skill config (created by install.sh).
# See https://github.com/behagoras/behagoras-skills for the full key list.
vault_dir=$VAULT_CHOICE
default_with_timestamps=false
default_force_audio=false
EOF
    green "  wrote: $CWD/.transcriptsrc (vault_dir=$VAULT_CHOICE)"
  fi
else
  yellow "  Skipping .transcriptsrc creation."
fi
echo

# ---------------------------------------------------------------------------
# 4) Dependency check
# ---------------------------------------------------------------------------
bold "4) Verify system dependencies?"
echo "   Required for the skill to actually run:"
echo "     yt-dlp       — video URL fetching"
echo "     ffmpeg       — audio extraction"
echo "     python3      — VTT cleaner & note builder"
echo "     mlx-whisper  — Apple Silicon only, audio transcription fallback"
echo
INSTALL_DEPS="${BSK_INSTALL_DEPS:-$(ask "Verify and offer to install missing deps?" "yes")}"
if [[ "${INSTALL_DEPS,,}" =~ ^(yes|y)$ ]]; then
  MISSING=()
  for tool in yt-dlp ffmpeg python3 mlx_whisper; do
    if command -v "$tool" >/dev/null 2>&1; then
      green "  ✓ $tool: $(command -v "$tool")"
    else
      red   "  ✗ $tool: not found"
      MISSING+=("$tool")
    fi
  done

  if [[ ${#MISSING[@]} -gt 0 ]]; then
    echo
    bold "  Missing: ${MISSING[*]}"
    if [[ "$(uname)" == "Darwin" ]]; then
      echo "  Suggested install commands (macOS):"
      [[ " ${MISSING[*]} " == *" yt-dlp "*  ]]    && echo "    brew install yt-dlp"
      [[ " ${MISSING[*]} " == *" ffmpeg "*  ]]    && echo "    brew install ffmpeg"
      [[ " ${MISSING[*]} " == *" python3 "* ]]    && echo "    brew install python"
      [[ " ${MISSING[*]} " == *" mlx_whisper "* ]] && {
        echo "    brew install pipx && pipx ensurepath && pipx install mlx-whisper"
        echo "    (note: mlx_whisper is Apple Silicon only)"
      }
    else
      echo "  Install them via your platform's package manager."
      echo "  Note: mlx_whisper requires Apple Silicon. On Linux/Windows the audio"
      echo "  fallback won't work, but the captions path still does."
    fi
  else
    green "  All deps present."
  fi
else
  yellow "  Skipping dep check."
fi
echo

bold "Done."
echo "Try it:  bash $SKILL_DIR/scripts/transcribe.sh 'https://youtu.be/jNQXAC9IVRw'"
