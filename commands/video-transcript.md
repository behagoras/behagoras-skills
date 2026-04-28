---
description: Extract a transcript from any video URL (YouTube, Instagram, TikTok, Vimeo, etc.)
argument-hint: <url>
---

Generic transcript entry point. Use when the URL isn't covered by the platform-specific commands or when you don't know the platform yet.

**URL given:** `$ARGUMENTS`

## Steps

1. **Run the skill's entry script** — `yt-dlp` underneath supports 1800+ sites, so platform detection is automatic:
   ```bash
   bash "$HOME/.claude/skills/video-transcript/scripts/transcribe.sh" "$ARGUMENTS"
   ```

2. **Read the produced markdown.** Show title + uploader + duration + which path was used (captions or audio). For short content, inline the transcript; for long, show metadata + first paragraph + path.

3. **Ask about a summary** with AskUserQuestion — match the user's language:
   - **TL;DR**
   - **Bullets**
   - **Detallado / Detailed**
   - **Sin resumen / Skip**

4. If they pick a level, generate the summary in the language of the transcript.

Flags: `--note` (save to Obsidian vault), `--force-audio` (skip captions, use Whisper — useful when auto-captions are mangled), `--timestamps` (one line per cue with `[MM:SS]` prefix), `--lang <code>` (hint the language). See `$HOME/.claude/skills/video-transcript/SKILL.md` for full docs.
