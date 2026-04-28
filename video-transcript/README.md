# video-transcript

Extract transcripts from any video URL — YouTube, Shorts, Instagram Reels, TikTok, Vimeo, and 1800+ other sites that `yt-dlp` supports. Falls back to a local whisper backend when captions are unavailable. **Cross-platform**: macOS (Apple Silicon, via `mlx_whisper`) and Linux (via `whisper-ctranslate2`, the CLI for `faster-whisper`) are both first-class.

> Looking for the model-facing contract? See [`SKILL.md`](./SKILL.md).

## Install

```bash
npx behagoras-skills install video-transcript
```

This wires up the skill in `~/.claude/skills/video-transcript`, links the slash commands (`/youtube-transcript`, `/instagram-transcript`, `/tiktok-transcript`, `/video-transcript`), and walks you through `.transcriptsrc` setup.

Run `npx behagoras-skills doctor` afterwards to verify `yt-dlp`, `ffmpeg`, and `python3` are on your `PATH`. The doctor will also flag the platform-appropriate whisper backend (`mlx_whisper` on macOS, `whisper-ctranslate2` on Linux) as optional — install it only if you need the audio fallback for captionless videos. See the [top-level README](../README.md#linux-setup) for the install one-liners on each platform.

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
