---
name: video-transcript
description: Extract transcripts from any video URL — YouTube videos, YouTube Shorts, Instagram Reels, TikToks, Vimeo, Twitter/X, and 1800+ other sites that yt-dlp supports. Use this skill whenever the user pastes a video URL and wants to know its content, asks for a transcript, asks "what does this video say", says things like "transcribe this", "summarize this video", "I want to know what's in this", "saca la transcripción", "qué dice este video", or shares a video link in a context where they're clearly asking about its contents — even when they don't explicitly say the word "transcribe". Handles two paths automatically — fast captions extraction when available, audio transcription via local mlx-whisper when not. After extraction, ALWAYS asks the user if they want a summary and at what level of detail (TL;DR / bullets / detailed / skip).
---

# Video Transcript Skill

Extract a clean text transcript from any video URL the user shares. Default behavior is to print the transcript to chat and save a markdown copy to `/tmp/transcripts/<video-id>/`. With `--note`, it also persists a copy as a vault note.

## When to trigger

Trigger this skill when the user:

- Pastes a YouTube URL (any form: `youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/shorts/...`)
- Pastes an Instagram Reel URL (`instagram.com/p/...` or `instagram.com/reel/...`)
- Pastes a TikTok, Twitter/X, Vimeo, or any other video-hosting URL
- Asks for a transcript, captions, subtitles, or "what's in this video"
- Asks to summarize a video (transcribe first, then summarize)
- Asks to download a video for note-taking purposes
- Says "saca la transcripción", "qué dice", "transcríbeme esto", or any equivalent phrasing in Spanish

If you're not sure whether a URL is a video, try the skill — it fails fast on non-video URLs, so a wrong guess is cheap.

## Quick start

The single entry point is `scripts/transcribe.sh`. It handles the full pipeline:

```bash
bash "$HOME/.claude/skills/video-transcript/scripts/transcribe.sh" <URL>
```

It prints status to stderr and the **final markdown path** as the last line of stdout. Read that file with the Read tool to get the transcript content for the chat.

### Common invocations

```bash
# Default: transcribe + save to /tmp only
bash "$HOME/.claude/skills/video-transcript/scripts/transcribe.sh" "https://www.youtube.com/watch?v=ID"

# Also save as vault note
bash "$HOME/.claude/skills/video-transcript/scripts/transcribe.sh" "<URL>" --note

# Force the audio path even if captions exist (useful when auto-captions are bad)
bash "$HOME/.claude/skills/video-transcript/scripts/transcribe.sh" "<URL>" --force-audio

# Hint the language (helps Whisper for short Spanish reels that auto-detect wrongly)
bash "$HOME/.claude/skills/video-transcript/scripts/transcribe.sh" "<URL>" --lang es
```

## How the script picks a path

```
URL → metadata probe → has captions? ─── yes ──→ download VTT, clean to text  (~2s, free)
                                       └─ no  ──→ download audio + mlx_whisper  (~1-2x realtime, free, local)
```

Captions path is always preferred when available — it's instant and accurate to the source. The audio path is the safety net for Reels, TikToks, and Shorts that don't carry captions.

## After the transcript exists — the summary protocol

This is non-optional and applies on every successful run. Once you have the transcript path:

1. **Show or relay the transcript.** For short content (≤ ~500 words), include it inline in your reply. For longer content, show the metadata + first paragraph + path to the full markdown.

2. **Always ask about a summary.** Use AskUserQuestion (or, if unavailable, plain prose) with these four options. Word the question naturally — match the language the user is speaking:

   - **TL;DR** — one or two sentences, the core point only
   - **Bullets** — 5-8 bullet points covering the key claims/moments
   - **Detallado** — structured sections (context, key points, takeaways), ~300-500 words
   - **Sin resumen** — skip, the transcript is enough

3. **If the user picks a level**, generate the summary from the transcript. Match the language of the transcript itself.

4. **If `--note` was used**, also save the summary as a separate file at `<vault>/AI Notes/summaries/<same-timestamp-and-slug>.md` so summaries live next to but apart from raw transcripts.

The reason the summary is opt-in per-call rather than baked into the workflow: sometimes the user wants the raw transcript for their own analysis, and rendering an unwanted summary is wasted tokens and noise. Asking once is cheap and respects their intent.

## Output structure

### `/tmp/transcripts/<id>/`
- `transcript.md` — canonical markdown with YAML frontmatter + transcript body
- `transcript.txt` — plain text only (used by `build_note.py`)
- `meta.json` — metadata used to build the note
- `cap.<lang>.vtt` — raw VTT (only when captions path was used)
- `audio.m4a` — raw audio (only when audio path was used)

### Vault note (only with `--note`)
`<vault>/AI Notes/transcripts/<YYYY-MM-DD HHMM> <slug>.md`

The slug is derived from the video title — ASCII-fold, strip non-alphanumerics, max 60 chars. Matches the existing convention for AI Notes (`2026-03-02 1618 How to Come Up With...`).

### Markdown frontmatter

```yaml
---
title: "..."
url: "..."
video_id: "..."
platform: youtube | instagram | tiktok | twitter | vimeo | ...
uploader: "..."
duration: "M:SS" or "H:MM:SS"
language: "en" | "es" | "auto" | ...
source: captions | audio
upload_date: "YYYYMMDD"
extracted_at: "YYYY-MM-DDTHH:MM:SS±HHMM"
tags: [transcript]
---
```

## Examples

### Example 1 — User shares a YouTube Short with captions

User: "https://www.youtube.com/shorts/jdfX3eU0UVg"

Steps:
1. Run `transcribe.sh "https://www.youtube.com/shorts/jdfX3eU0UVg"`
2. Read the markdown path printed by the script
3. Reply with title + uploader + transcript inline (it's short)
4. Ask the summary question (4 options)

### Example 2 — User shares an Instagram Reel

User: "Sácame qué dice este reel: https://www.instagram.com/p/DW2TanyDrRW/"

Steps:
1. Run `transcribe.sh "<url>"` — script will fall back to audio path (no IG captions)
2. Read the markdown path
3. Reply in Spanish (user wrote in Spanish), include transcript
4. Ask the summary question in Spanish

### Example 3 — User wants to keep it in their vault

User: "Bájame este video y guárdalo en mi vault: https://youtu.be/abc"

Steps:
1. Run `transcribe.sh "<url>" --note`
2. Confirm both the `/tmp` path and the vault note path
3. Show transcript + ask summary
4. If user picks a summary level, also save it to `AI Notes/summaries/<same-name>.md`

### Example 4 — Auto-captions are bad and user re-asks

User (after seeing a poor auto-generated transcript): "Hazlo de nuevo pero con audio, los captions están mal"

Steps:
1. Run `transcribe.sh "<url>" --force-audio --lang es`
2. Same flow as before with the new (better) transcript

## Why these decisions

- **`yt-dlp` over Playwright/scrapers**: `yt-dlp` is mature, supports 1800+ sites, and updates faster than YouTube can break it. Playwright would be slower, fragile (DOM changes), and more bot-detectable. There is no scenario in this skill where Playwright is needed.
- **`mlx-whisper` over CPU whisper or cloud APIs**: The user runs Apple Silicon. MLX is 30-40% faster than `whisper.cpp` and orders of magnitude faster than CPU-only Python whisper, while staying free and private. Cloud APIs (Groq, OpenAI) are valid future options but we don't want to require API keys for the default path.
- **Captions preferred over audio re-transcription**: Auto-captions on YouTube are usually accurate enough, instant, and identify language for free. Audio transcription is the fallback, not the default.
- **Summary always opt-in**: The user asked for this explicitly. Don't summarize unprompted; ask first. Match the language of the conversation when asking.

## Troubleshooting

If anything misbehaves, see [references/troubleshooting.md](references/troubleshooting.md).
