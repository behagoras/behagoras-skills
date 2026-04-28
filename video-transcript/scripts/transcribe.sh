#!/usr/bin/env bash
# transcribe.sh - Extract transcript from any video URL yt-dlp can reach.
#
# Strategy:
#   1) Probe metadata (yt-dlp --dump-json)
#   2) Try the captions path: yt-dlp --write-subs / --write-auto-subs
#   3) If no captions, fall back to audio: yt-dlp -x --audio-format m4a + mlx_whisper
#   4) Build markdown with YAML frontmatter via build_note.py
#
# Usage:
#   transcribe.sh <url> [--note] [--force-audio] [--timestamps] [--lang LANG] [--vault-dir DIR]
#
# Output:
#   /tmp/transcripts/<id>/transcript.md  (always)
#   <vault-dir>/AI Notes/transcripts/<YYYY-MM-DD HHMM> <slug>.md  (if --note)
#
# Prints the path to the canonical /tmp markdown on success (last line of stdout).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR_DEFAULT="${HOME}/Documents/Vault"

URL=""
WRITE_NOTE=0
FORCE_AUDIO=0
WITH_TIMESTAMPS=0
LANG_HINT=""
VAULT_DIR="${YT_TRANSCRIPT_VAULT:-$VAULT_DIR_DEFAULT}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --note) WRITE_NOTE=1; shift ;;
    --force-audio) FORCE_AUDIO=1; shift ;;
    --timestamps) WITH_TIMESTAMPS=1; shift ;;
    --lang) LANG_HINT="$2"; shift 2 ;;
    --vault-dir) VAULT_DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,17p' "$0"; exit 0 ;;
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
  echo "Usage: transcribe.sh <url> [--note] [--force-audio] [--timestamps] [--lang LANG] [--vault-dir DIR]" >&2
  exit 2
fi

# --- dependency checks ---
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required tool: $1" >&2; exit 3; }; }
need yt-dlp
need ffmpeg
need python3

log() { echo "[transcribe] $*" >&2; }

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
if [[ -z "$PATH_USED" ]]; then
  log "Downloading audio for transcription"
  AUDIO_FILE="$WORKDIR/audio.m4a"
  yt-dlp --no-warnings -x --audio-format m4a \
    -o "$WORKDIR/audio.%(ext)s" "$URL" >&2 || {
      echo "ERROR: yt-dlp failed to download audio for $URL" >&2
      exit 5
    }
  if [[ ! -f "$AUDIO_FILE" ]]; then
    # yt-dlp may have produced a different extension; pick the freshest media
    AUDIO_FILE=$(ls -1t "$WORKDIR"/audio.* 2>/dev/null | grep -vE '\.json$|\.txt$|\.md$' | head -1 || true)
  fi
  if [[ -z "$AUDIO_FILE" || ! -f "$AUDIO_FILE" ]]; then
    echo "ERROR: Audio file not found after yt-dlp run" >&2
    exit 5
  fi
  log "Transcribing audio with mlx_whisper: $AUDIO_FILE"
  if ! command -v mlx_whisper >/dev/null 2>&1; then
    echo "ERROR: mlx_whisper not installed. Run: pipx install mlx-whisper" >&2
    exit 6
  fi
  # When timestamps are requested we ask mlx_whisper for VTT (timestamps preserved).
  # Plain text comes out cleanly without further processing for non-timestamp mode.
  if [[ $WITH_TIMESTAMPS -eq 1 ]]; then
    WHISPER_ARGS=(--model "mlx-community/whisper-large-v3-mlx" --output-dir "$WORKDIR" --output-format vtt)
  else
    WHISPER_ARGS=(--model "mlx-community/whisper-large-v3-mlx" --output-dir "$WORKDIR" --output-format txt)
  fi
  if [[ -n "$LANG_HINT" ]]; then WHISPER_ARGS+=(--language "$LANG_HINT"); fi
  mlx_whisper "${WHISPER_ARGS[@]}" "$AUDIO_FILE" >&2
  if [[ $WITH_TIMESTAMPS -eq 1 ]]; then
    WHISPER_VTT=$(ls -1 "$WORKDIR"/audio*.vtt 2>/dev/null | head -1 || true)
    if [[ -z "$WHISPER_VTT" ]]; then
      echo "ERROR: mlx_whisper did not produce a .vtt output" >&2
      exit 6
    fi
    python3 "$SCRIPT_DIR/vtt_to_text.py" --with-timestamps "$WHISPER_VTT" > "$TRANSCRIPT_TXT"
  else
    WHISPER_TXT=$(ls -1 "$WORKDIR"/audio*.txt 2>/dev/null | head -1 || true)
    if [[ -z "$WHISPER_TXT" ]]; then
      echo "ERROR: mlx_whisper did not produce a .txt output" >&2
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

python3 - <<PY > "$META_FILE"
import json
meta = {
  "id": "$VIDEO_ID",
  "title": """$TITLE""",
  "url": "$URL",
  "uploader": """$UPLOADER""",
  "duration": $DURATION,
  "platform": "$PLATFORM",
  "language": "$LANG_USED",
  "source": "$PATH_USED",
  "upload_date": "$UPLOAD_DATE",
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

# Final line of stdout = canonical markdown path (skill consumer reads this)
echo "$TRANSCRIPT_MD"
