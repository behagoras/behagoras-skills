---
description: Extract a transcript from a YouTube video, Short, or live URL
argument-hint: <youtube-url>
---

The user wants to extract a transcript from a YouTube URL. This is a thin alias for the `video-transcript` skill, scoped to YouTube.

**URL given:** `$ARGUMENTS`

## Steps

1. **Validate the URL.** Confirm `$ARGUMENTS` matches one of: `youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/shorts/...`, or `youtube.com/live/...`. If it doesn't, point that out and suggest `/instagram-transcript`, `/tiktok-transcript`, or `/video-transcript` (generic) depending on what the URL looks like — don't blindly run.

2. **Run the skill's entry script** on the URL:
   ```bash
   bash "$HOME/.claude/skills/video-transcript/scripts/transcribe.sh" "$ARGUMENTS"
   ```
   Last line of stdout is the path to the canonical markdown.

3. **Read the produced markdown** with the Read tool. Show the user title + uploader + duration, and:
   - For short content (≤ ~500 words), include the transcript inline.
   - For longer content, show metadata + first paragraph + path to the full file.

4. **Ask about a summary** using AskUserQuestion (or plain prose if unavailable). 4 options — match the user's language:
   - **TL;DR** — one or two sentences
   - **Bullets** — 5-8 key points
   - **Detallado / Detailed** — structured 300-500 words
   - **Sin resumen / Skip** — the transcript is enough

5. If they pick a level, generate the summary in the language of the transcript.

If the user explicitly wants to save in their vault, re-run with `--note`. If auto-captions look bad, re-run with `--force-audio`. See `$HOME/.claude/skills/video-transcript/SKILL.md` for full documentation.
