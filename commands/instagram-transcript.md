---
description: Extract a transcript from an Instagram Reel, post, or video URL
argument-hint: <instagram-url>
---

The user wants to extract a transcript from an Instagram URL. Thin alias for the `video-transcript` skill, scoped to Instagram.

**URL given:** `$ARGUMENTS`

## Steps

1. **Validate the URL.** Confirm `$ARGUMENTS` matches `instagram.com/reel/...`, `instagram.com/p/...`, or `instagram.com/tv/...`. If it doesn't, suggest `/youtube-transcript`, `/tiktok-transcript`, or `/video-transcript` (generic) instead.

2. **Run the skill's entry script:**
   ```bash
   bash "$HOME/.claude/skills/video-transcript/scripts/transcribe.sh" "$ARGUMENTS"
   ```
   Instagram has no captions, so the script will fall back to the audio path automatically (yt-dlp downloads the audio, mlx-whisper transcribes locally). Expect ~30-90s for short reels with the model already cached.

3. **Read the produced markdown** with the Read tool. Show title + uploader + duration. Reels are typically short, so include the transcript inline.

4. **Ask about a summary** with AskUserQuestion — match the user's language:
   - **TL;DR**
   - **Bullets**
   - **Detallado / Detailed**
   - **Sin resumen / Skip**

5. If they pick a level, generate the summary in the language of the transcript.

For private accounts or login-gated content, see the troubleshooting section in `$HOME/.claude/skills/video-transcript/references/troubleshooting.md` (uses browser cookies via `--cookies-from-browser`). To save in vault add `--note`. Use `--lang es` for Spanish-only content if Whisper auto-detection misfires.
