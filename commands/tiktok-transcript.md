---
description: Extract a transcript from a TikTok video URL
argument-hint: <tiktok-url>
---

The user wants to extract a transcript from a TikTok URL. Thin alias for the `video-transcript` skill, scoped to TikTok.

**URL given:** `$ARGUMENTS`

## Steps

1. **Validate the URL.** Confirm `$ARGUMENTS` matches `tiktok.com/@.../video/...` or a `vm.tiktok.com/...` short link. If it doesn't, suggest `/youtube-transcript`, `/instagram-transcript`, or `/video-transcript` (generic) instead.

2. **Run the skill's entry script:**
   ```bash
   bash "$HOME/.claude/skills/video-transcript/scripts/transcribe.sh" "$ARGUMENTS"
   ```
   TikToks generally don't carry captions, so the script will fall back to the audio path (mlx-whisper). Expect ~30-90s for typical short clips with model cached.

3. **Read the produced markdown** with the Read tool. Show title + uploader + duration; include the transcript inline (TikToks are short).

4. **Ask about a summary** with AskUserQuestion — match the user's language:
   - **TL;DR**
   - **Bullets**
   - **Detallado / Detailed**
   - **Sin resumen / Skip**

5. If they pick a level, generate the summary in the language of the transcript.

If TikTok geo-blocks the IP or shows a login wall, see `$HOME/.claude/skills/video-transcript/references/troubleshooting.md` (`--cookies-from-browser` workaround). For Spanish-only content, pass `--lang es`. To persist in vault, pass `--note`.
