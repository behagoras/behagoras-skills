# video-transcript

Extract transcripts from any video URL — YouTube, Shorts, Instagram Reels, TikTok, Vimeo, and 1800+ other sites that `yt-dlp` supports. Falls back to local Whisper (Apple Silicon) when captions are unavailable.

> Looking for the model-facing contract? See [`SKILL.md`](./SKILL.md).

## Install

```bash
npx behagoras-skills install video-transcript
```

This wires up the skill in `~/.claude/skills/video-transcript`, links the slash commands (`/youtube-transcript`, `/instagram-transcript`, `/tiktok-transcript`, `/video-transcript`), and walks you through `.transcriptsrc` setup.

Run `npx behagoras-skills doctor` afterwards to verify `yt-dlp`, `ffmpeg`, and `python3` are on your `PATH` — and `mlx_whisper` too if you're on Apple Silicon and want the audio-fallback path.

## Slash commands

| Command | Use for |
|---|---|
| `/youtube-transcript <url>` | YouTube videos, Shorts, and live URLs |
| `/instagram-transcript <url>` | Instagram Reels and posts |
| `/tiktok-transcript <url>` | TikTok videos |
| `/video-transcript <url>` | Generic — anything `yt-dlp` supports |

## Configuration

Drop a `.transcriptsrc` at the root of any project (or in `$HOME` for a global default). The skill walks up from CWD looking for the first one. See the [top-level README](../README.md#configuration--transcriptsrc) for the full key list, or use the installer's interactive prompts to generate one.

## Uninstall

```bash
npx behagoras-skills uninstall video-transcript
```

Removes the symlinks under `~/.claude/skills/` and `~/.claude/commands/`. Your repo clone, `.transcriptsrc`, and any transcripts on disk are untouched.
