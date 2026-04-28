# Troubleshooting

Common failures and how to fix them.

## `yt-dlp` says "Sign in to confirm you're not a bot"

YouTube occasionally serves a bot challenge to fresh IPs or after rate-limiting.

- Wait 5-10 minutes and retry — usually self-resolves.
- If persistent on this machine, generate a cookies file from your browser and pass it:
  `yt-dlp --cookies-from-browser firefox <url>` (or `chrome`, `safari`).
- The script doesn't pass `--cookies-from-browser` by default to keep things simple. If you hit this often on the same machine, modify `transcribe.sh` to add it.

## "All Piped instances failed" (legacy `transcript.js`)

Not from this skill — that's the older Spider script at `spider/scripts/transcript.js` that uses Piped API instances. Most Piped instances are unreliable in 2026. This skill bypasses that entirely by using `yt-dlp` directly.

## `mlx_whisper: command not found`

Install:
```bash
pipx install mlx-whisper
```

The skill expects `mlx_whisper` on `$PATH`. After install, verify with `which mlx_whisper`.

## Audio path is slow

Default model is `mlx-community/whisper-large-v3-mlx` — most accurate, ~1-2x realtime on M-series. For long videos where speed matters more than accuracy, swap to a smaller model in `transcribe.sh`:

- `mlx-community/whisper-medium-mlx` — ~3-5x faster, slight accuracy drop
- `mlx-community/whisper-tiny-mlx` — very fast, only OK for English/clean audio

## Whisper detected the wrong language

Pass `--lang es` (or `--lang en`, etc.) explicitly. Auto-detection on very short clips (<10s) is unreliable.

## Instagram reels: "Restricted Video" or login required

Some IG content (private accounts, age-gated) requires authentication. yt-dlp can use browser cookies:

```bash
yt-dlp --cookies-from-browser firefox <url>
```

If you need this regularly, add the flag to `transcribe.sh`.

## Captions are auto-generated and clearly wrong

Use `--force-audio` to skip captions and re-transcribe via Whisper:

```bash
transcribe.sh <url> --force-audio --lang es
```

Whisper-large-v3 typically produces noticeably cleaner output than YouTube's auto-captions, especially for non-English content.

## Vault path doesn't exist

Default vault is `$HOME/Documents/Vault`. Override with `--vault-dir /path/to/vault` or set the `YT_TRANSCRIPT_VAULT` env var (e.g. add `export YT_TRANSCRIPT_VAULT="$HOME/path/to/your/obsidian-vault"` to your shell rc).

The `--note` flag writes to `<vault>/AI Notes/transcripts/`. The script will `mkdir -p` that subdirectory, but the vault root must exist.

## Transcript is empty or just whitespace

- Captions path: the VTT may have only timing tags with no actual text. Re-run with `--force-audio`.
- Audio path: the video may be silent or music-only. Whisper should still detect this and produce minimal output. Check `/tmp/transcripts/<id>/audio.m4a` to confirm audio was captured.

## Running the script directly for debugging

```bash
bash -x "$HOME/.claude/skills/video-transcript/scripts/transcribe.sh" <url>
```

`bash -x` traces every command. Useful when something fails silently.
