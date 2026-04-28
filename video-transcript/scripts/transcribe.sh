#!/usr/bin/env bash
# transcribe.sh - Extract transcript from any video URL yt-dlp can reach.
#
# Strategy:
#   1) Probe metadata (yt-dlp --dump-json)
#   2) Try the captions path: yt-dlp --write-subs / --write-auto-subs
#   3) If no captions, fall back to audio:
#        - macOS (Darwin) → mlx_whisper (Apple Silicon, large-v3)
#        - Linux          → whisper-ctranslate2 (small int8, ~250MB model)
#   4) Build markdown with YAML frontmatter via build_note.py
#   5) On success, delete the downloaded audio + temp dir unless --keep-audio.
#
# Usage:
#   transcribe.sh <url> [--note] [--force-audio] [--timestamps] [--lang LANG]
#                       [--vault-dir DIR] [--keep-audio]
#
# Output:
#   /tmp/transcripts/<id>/transcript.md  (always)
#   <vault-dir>/AI Notes/transcripts/<YYYY-MM-DD HHMM> <slug>.md  (if --note)
#
# Prints the path to the canonical /tmp markdown on success (last line of stdout).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { echo "[transcribe] $*" >&2; }

URL=""
WRITE_NOTE=0
FORCE_AUDIO=0
WITH_TIMESTAMPS=0
LANG_HINT=""
VAULT_DIR_FROM_FLAG=""
KEEP_AUDIO=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --note) WRITE_NOTE=1; shift ;;
    --force-audio) FORCE_AUDIO=1; shift ;;
    --timestamps) WITH_TIMESTAMPS=1; shift ;;
    --lang) LANG_HINT="$2"; shift 2 ;;
    --vault-dir) VAULT_DIR_FROM_FLAG="$2"; shift 2 ;;
    --keep-audio) KEEP_AUDIO=1; shift ;;
    -h|--help)
      sed -n '2,21p' "$0"; exit 0 ;;
    --) shift; URL="$1"; shift ;;
    -*)
      echo "Unknown flag: $1" >&2; exit 2 ;;
    *)
      if [[ -z "$URL" ]]; then URL="$1"; else
        echo "Unexpected extra arg: $1" >&2; exit 2
      fi
      shift ;;
  esac
done

if [[ -z "$URL" ]]; then
  echo "Usage: transcribe.sh <url> [--note] [--force-audio] [--timestamps] [--lang LANG] [--vault-dir DIR] [--keep-audio]" >&2
  exit 2
fi

# --- Config discovery (.transcriptsrc) ---
# Walks up from CWD looking for a .transcriptsrc file, then falls back to
# ~/.transcriptsrc. Strict parser — only known keys are read; arbitrary shell
# in the file is NOT executed.
#
# Recognized keys:
#   vault_dir                  — path for --note (relative paths anchor to the
#                                .transcriptsrc location, not CWD)
#   default_with_timestamps    — 1/true/yes to enable --timestamps by default
#   default_force_audio        — 1/true/yes to enable --force-audio by default
find_config() {
  local dir
  dir="$(pwd -P)"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/.transcriptsrc" ]]; then
      echo "$dir/.transcriptsrc"; return 0
    fi
    dir="$(dirname "$dir")"
  done
  if [[ -f "$HOME/.transcriptsrc" ]]; then
    echo "$HOME/.transcriptsrc"; return 0
  fi
  return 1
}

parse_config_value() {
  local file="$1" key="$2"
  grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" 2>/dev/null \
    | grep -v "^[[:space:]]*#" \
    | head -1 \
    | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//; s/[[:space:]]*#.*$//; s/^['\"]//; s/['\"][[:space:]]*$//"
}

is_truthy() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

CFG_VAULT_DIR=""
CFG_FILE="$(find_config || true)"
if [[ -n "$CFG_FILE" ]]; then
  CFG_DIR="$(dirname "$CFG_FILE")"
  log "Using config: $CFG_FILE"
  CFG_VAULT_DIR="$(parse_config_value "$CFG_FILE" "vault_dir")"
  CFG_DEFAULT_TS="$(parse_config_value "$CFG_FILE" "default_with_timestamps")"
  CFG_DEFAULT_FA="$(parse_config_value "$CFG_FILE" "default_force_audio")"
  # Apply config defaults only if the user didn't pass the corresponding flag.
  [[ $WITH_TIMESTAMPS -eq 0 ]] && is_truthy "$CFG_DEFAULT_TS" && WITH_TIMESTAMPS=1
  [[ $FORCE_AUDIO -eq 0 ]] && is_truthy "$CFG_DEFAULT_FA" && FORCE_AUDIO=1
  # Resolve vault_dir: expand ~ / $HOME, anchor relative paths to CFG_DIR.
  if [[ -n "$CFG_VAULT_DIR" ]]; then
    case "$CFG_VAULT_DIR" in
      "~"*)      CFG_VAULT_DIR="${HOME}${CFG_VAULT_DIR:1}" ;;
      "\$HOME"*) CFG_VAULT_DIR="${HOME}${CFG_VAULT_DIR:5}" ;;
    esac
    [[ "$CFG_VAULT_DIR" != /* ]] && CFG_VAULT_DIR="$CFG_DIR/$CFG_VAULT_DIR"
  fi
fi

# Vault precedence: --vault-dir flag > YT_TRANSCRIPT_VAULT env > config > ./.transcripts
if [[ -n "$VAULT_DIR_FROM_FLAG" ]]; then
  VAULT_DIR="$VAULT_DIR_FROM_FLAG"
elif [[ -n "${YT_TRANSCRIPT_VAULT:-}" ]]; then
  VAULT_DIR="$YT_TRANSCRIPT_VAULT"
elif [[ -n "$CFG_VAULT_DIR" ]]; then
  VAULT_DIR="$CFG_VAULT_DIR"
else
  VAULT_DIR="$(pwd)/.transcripts"
fi

# --- dependency checks ---
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required tool: $1" >&2; exit 3; }; }
need yt-dlp
need ffmpeg
need python3

# --- 1) probe metadata ---
log "Probing metadata for $URL"
META_JSON=$(yt-dlp --no-warnings --skip-download --dump-single-json "$URL" 2>/dev/null) || {
  echo "ERROR: yt-dlp failed to fetch metadata for $URL" >&2
  exit 4
}

VIDEO_ID=$(printf '%s' "$META_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
TITLE=$(printf '%s' "$META_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('title',''))")
UPLOADER=$(printf '%s' "$META_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('uploader') or d.get('channel') or '')")
DURATION=$(printf '%s' "$META_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('duration') or 0)")
EXTRACTOR=$(printf '%s' "$META_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('extractor_key') or d.get('extractor') or '')")
UPLOAD_DATE=$(printf '%s' "$META_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('upload_date') or '')")

if [[ -z "$VIDEO_ID" ]]; then
  echo "ERROR: Could not extract video id from $URL" >&2
  exit 4
fi

WORKDIR="/tmp/transcripts/$VIDEO_ID"
mkdir -p "$WORKDIR"
META_FILE="$WORKDIR/meta.json"
TRANSCRIPT_TXT="$WORKDIR/transcript.txt"
TRANSCRIPT_MD="$WORKDIR/transcript.md"

# --- 2) decide path ---
PATH_USED=""
LANG_USED=""

if [[ $FORCE_AUDIO -eq 1 ]]; then
  log "Forcing audio path (--force-audio)"
else
  log "Trying captions path"
  # Prefer manual subs, fall back to auto. Honor --lang if given, else en/es/auto.
  SUB_LANGS="${LANG_HINT:-en.*,es.*,en,es}"
  set +e
  yt-dlp --no-warnings --skip-download \
    --write-subs --write-auto-subs \
    --sub-langs "$SUB_LANGS" --sub-format "vtt" \
    -o "$WORKDIR/cap.%(ext)s" "$URL" >/dev/null 2>&1
  rc=$?
  set -e
  # Find any .vtt that was written
  VTT_FILE=$(ls -1 "$WORKDIR"/cap*.vtt 2>/dev/null | head -1 || true)
  if [[ -n "$VTT_FILE" ]]; then
    log "Captions found: $VTT_FILE"
    PATH_USED="captions"
    # detect language from filename: cap.<lang>.vtt
    LANG_USED=$(basename "$VTT_FILE" | sed -E 's/^cap\.//; s/\.vtt$//')
    if [[ $WITH_TIMESTAMPS -eq 1 ]]; then
      python3 "$SCRIPT_DIR/vtt_to_text.py" --with-timestamps "$VTT_FILE" > "$TRANSCRIPT_TXT"
    else
      python3 "$SCRIPT_DIR/vtt_to_text.py" "$VTT_FILE" > "$TRANSCRIPT_TXT"
    fi
  else
    log "No captions available (yt-dlp rc=$rc); falling back to audio"
  fi
fi

# --- 3) audio fallback ---
#
# whisper_transcribe <audio-file> <output-dir> <"vtt"|"txt"> [<lang>]
#
# Dispatches to the right whisper backend for the host OS:
#   - Darwin → mlx_whisper (Apple-Silicon, large-v3)
#   - Linux  → whisper-ctranslate2 (small int8, ~250MB model — fits a 4GB VPS)
# On any other platform, exits with a clear message.
#
# Output contract: writes one of audio*.vtt OR audio*.txt into <output-dir>
# (whichever matches the requested format). The caller still does the
# vtt_to_text.py post-processing for timestamp mode.
whisper_transcribe() {
  local audio_file="$1"
  local out_dir="$2"
  local out_format="$3"  # vtt | txt
  local lang="${4:-}"
  local backend
  case "$(uname -s)" in
    Darwin) backend="mlx" ;;
    Linux)  backend="faster" ;;
    *)      backend="unsupported" ;;
  esac

  case "$backend" in
    mlx)
      if ! command -v mlx_whisper >/dev/null 2>&1; then
        echo "ERROR: mlx_whisper not installed. Run: pipx install mlx-whisper (Apple Silicon required)." >&2
        return 6
      fi
      local args=(--model "mlx-community/whisper-large-v3-mlx" \
                  --output-dir "$out_dir" --output-format "$out_format")
      [[ -n "$lang" ]] && args+=(--language "$lang")
      mlx_whisper "${args[@]}" "$audio_file" >&2
      ;;
    faster)
      if ! command -v whisper-ctranslate2 >/dev/null 2>&1; then
        echo "ERROR: whisper-ctranslate2 not installed. Run: pipx install whisper-ctranslate2" >&2
        return 6
      fi
      # whisper-ctranslate2 is the official CLI built on top of faster-whisper.
      # Plain 'faster-whisper' on PyPI is a library, not a CLI — that's why we
      # invoke this wrapper instead. The small int8 model is a ~250MB download
      # on first use, cached under ~/.cache/huggingface/. compute_type=int8
      # keeps RAM near 1GB so it coexists with other services on a 4GB VPS.
      local args=(--model small --compute_type int8 \
                  --output_format "$out_format" --output_dir "$out_dir")
      [[ -n "$lang" ]] && args+=(--language "$lang")
      whisper-ctranslate2 "${args[@]}" "$audio_file" >&2
      ;;
    unsupported)
      echo "ERROR: unsupported platform ($(uname -s)) for audio fallback; use the captions path." >&2
      return 6
      ;;
  esac
}

# Track files we downloaded so cleanup only touches what we created.
DOWNLOADED_AUDIO=""

if [[ -z "$PATH_USED" ]]; then
  log "Downloading audio for transcription"
  AUDIO_FILE="$WORKDIR/audio.m4a"
  yt-dlp --no-warnings -x --audio-format m4a \
    -o "$WORKDIR/audio.%(ext)s" "$URL" >&2 || {
      echo "ERROR: yt-dlp failed to download audio for $URL" >&2
      echo "       Audio (if any) left at: $WORKDIR (not cleaned — debug or retry)" >&2
      exit 5
    }
  if [[ ! -f "$AUDIO_FILE" ]]; then
    # yt-dlp may have produced a different extension; pick the freshest media
    AUDIO_FILE=$(ls -1t "$WORKDIR"/audio.* 2>/dev/null | grep -vE '\.json$|\.txt$|\.md$' | head -1 || true)
  fi
  if [[ -z "$AUDIO_FILE" || ! -f "$AUDIO_FILE" ]]; then
    echo "ERROR: Audio file not found after yt-dlp run" >&2
    echo "       Workdir left for inspection: $WORKDIR" >&2
    exit 5
  fi
  DOWNLOADED_AUDIO="$AUDIO_FILE"
  log "Transcribing audio with $(uname -s) backend: $AUDIO_FILE"
  if [[ $WITH_TIMESTAMPS -eq 1 ]]; then
    if ! whisper_transcribe "$AUDIO_FILE" "$WORKDIR" vtt "$LANG_HINT"; then
      echo "       Audio left for inspection: $AUDIO_FILE" >&2
      exit 6
    fi
    WHISPER_VTT=$(ls -1 "$WORKDIR"/audio*.vtt 2>/dev/null | head -1 || true)
    if [[ -z "$WHISPER_VTT" ]]; then
      echo "ERROR: whisper backend did not produce a .vtt output" >&2
      echo "       Audio left for inspection: $AUDIO_FILE" >&2
      exit 6
    fi
    python3 "$SCRIPT_DIR/vtt_to_text.py" --with-timestamps "$WHISPER_VTT" > "$TRANSCRIPT_TXT"
  else
    if ! whisper_transcribe "$AUDIO_FILE" "$WORKDIR" txt "$LANG_HINT"; then
      echo "       Audio left for inspection: $AUDIO_FILE" >&2
      exit 6
    fi
    WHISPER_TXT=$(ls -1 "$WORKDIR"/audio*.txt 2>/dev/null | head -1 || true)
    if [[ -z "$WHISPER_TXT" ]]; then
      echo "ERROR: whisper backend did not produce a .txt output" >&2
      echo "       Audio left for inspection: $AUDIO_FILE" >&2
      exit 6
    fi
    cp "$WHISPER_TXT" "$TRANSCRIPT_TXT"
  fi
  PATH_USED="audio"
  LANG_USED="${LANG_HINT:-auto}"
fi

# --- 4) build markdown ---
PLATFORM="$EXTRACTOR"
case "$EXTRACTOR" in
  Youtube*|youtube*) PLATFORM="youtube" ;;
  Instagram*) PLATFORM="instagram" ;;
  TikTok*|tiktok*) PLATFORM="tiktok" ;;
  Twitter*|X*) PLATFORM="twitter" ;;
esac

# Build meta.json from the original yt-dlp metadata (avoids interpolating
# untrusted strings like the video title into a Python heredoc).
META_DUR="$DURATION" \
META_PLATFORM="$PLATFORM" \
META_LANG="$LANG_USED" \
META_SOURCE="$PATH_USED" \
python3 - "$URL" "$VIDEO_ID" "$TITLE" "$UPLOADER" "$UPLOAD_DATE" <<'PY' > "$META_FILE"
import json, os, sys
url, vid, title, uploader, upload_date = sys.argv[1:6]
duration_raw = os.environ.get("META_DUR", "0")
try:
    duration = int(duration_raw) if duration_raw else 0
except ValueError:
    duration = 0
meta = {
    "id": vid,
    "title": title,
    "url": url,
    "uploader": uploader,
    "duration": duration,
    "platform": os.environ.get("META_PLATFORM", ""),
    "language": os.environ.get("META_LANG", ""),
    "source": os.environ.get("META_SOURCE", ""),
    "upload_date": upload_date,
}
print(json.dumps(meta, ensure_ascii=False, indent=2))
PY

python3 "$SCRIPT_DIR/build_note.py" \
  --meta "$META_FILE" \
  --transcript "$TRANSCRIPT_TXT" \
  --out "$TRANSCRIPT_MD" >/dev/null

# --- 5) optional vault note ---
if [[ $WRITE_NOTE -eq 1 ]]; then
  TS=$(date "+%Y-%m-%d %H%M")
  SLUG=$(printf '%s' "$TITLE" \
    | python3 -c "import sys,re,unicodedata
t=sys.stdin.read().strip()
t=unicodedata.normalize('NFKD',t).encode('ascii','ignore').decode()
t=re.sub(r'[^A-Za-z0-9 -]+',' ',t)
t=re.sub(r'\s+',' ',t).strip()
print(t[:60].rstrip())")
  NOTE_NAME="$TS $SLUG.md"
  NOTE_DIR="$VAULT_DIR/AI Notes/transcripts"
  mkdir -p "$NOTE_DIR"
  cp "$TRANSCRIPT_MD" "$NOTE_DIR/$NOTE_NAME"
  log "Wrote vault note: $NOTE_DIR/$NOTE_NAME"
fi

# --- 6) cleanup of downloaded audio ---
#
# Always-on by design (the VPS this runs on is disk-constrained). The user
# can opt out with --keep-audio when they want to re-run with different flags
# without re-downloading.
#
# We only delete files the script itself produced from the download:
#   - audio.<ext> (m4a/opus/webm) — the yt-dlp output
#   - audio*.vtt / audio*.txt     — the whisper sidecar outputs
# We do NOT touch transcript.md, transcript.txt, meta.json, or cap*.vtt
# (captions). If the workdir is empty after that, remove it too.
if [[ $PATH_USED == "audio" && $KEEP_AUDIO -eq 0 && -n "$DOWNLOADED_AUDIO" ]]; then
  # Compute size before deletion (best-effort; portable du across darwin/linux).
  CLEANED_SIZE=""
  if [[ -d "$WORKDIR" ]]; then
    CLEANED_SIZE=$(du -sh "$WORKDIR" 2>/dev/null | awk '{print $1}' || true)
  fi
  # Match the audio download + whisper sidecars we created. The leading
  # "audio." prefix is hardcoded by the yt-dlp -o template above.
  shopt -s nullglob
  for f in "$WORKDIR"/audio.* "$WORKDIR"/audio*.vtt "$WORKDIR"/audio*.txt; do
    [[ -f "$f" && "$f" != "$TRANSCRIPT_TXT" && "$f" != "$TRANSCRIPT_MD" ]] && rm -f "$f"
  done
  shopt -u nullglob
  log "Cleaned up audio artifacts (was ${CLEANED_SIZE:-unknown})"
elif [[ $PATH_USED == "audio" && $KEEP_AUDIO -eq 1 ]]; then
  log "Keeping audio file (--keep-audio): $DOWNLOADED_AUDIO"
fi

# Final line of stdout = canonical markdown path (skill consumer reads this)
echo "$TRANSCRIPT_MD"
