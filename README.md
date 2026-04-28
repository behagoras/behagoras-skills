# behagoras-skills

A collection of [Claude Code Skills](https://docs.claude.com/en/docs/claude-code/skills) maintained by [@behagoras](https://github.com/behagoras).

Skills are self-contained capabilities that Claude can discover and apply to specific tasks. Each folder under this repo is one skill.

## Skills

| Skill | Description |
|---|---|
| [`video-transcript`](./video-transcript/) | Extract transcripts from any video URL — YouTube, Shorts, Instagram Reels, TikTok, and 1800+ other sites via `yt-dlp`, with local Whisper fallback for videos without captions. |

## Slash commands

Discoverability aliases that all delegate to the `video-transcript` skill. They differ only in the URL validation they apply.

| Command | Use for |
|---|---|
| [`/youtube-transcript <url>`](./commands/youtube-transcript.md) | YouTube videos, Shorts, and live URLs |
| [`/instagram-transcript <url>`](./commands/instagram-transcript.md) | Instagram Reels and posts |
| [`/tiktok-transcript <url>`](./commands/tiktok-transcript.md) | TikTok videos |
| [`/video-transcript <url>`](./commands/video-transcript.md) | Generic — anything `yt-dlp` supports |

## Installing

### 1. System dependencies

The `video-transcript` skill needs `yt-dlp`, `ffmpeg`, Python 3.9+, and (for the audio fallback) `mlx-whisper`.

**macOS (Apple Silicon — full functionality):**

```bash
brew install yt-dlp ffmpeg pipx
pipx ensurepath
pipx install mlx-whisper
```

**macOS Intel / Linux / Windows:** the captions path works, but the audio fallback (used when a video has no captions, e.g. Instagram Reels and TikToks) requires `mlx-whisper`, which is **Apple Silicon only**. On other platforms you can either:
- Stick to URLs that have captions (most YouTube videos do), or
- Replace the audio path with [`whisper.cpp`](https://github.com/ggerganov/whisper.cpp) or the OpenAI/Groq Whisper API by editing `scripts/transcribe.sh` (the `mlx_whisper` invocation is one block).

**First audio run downloads the Whisper model** (~3GB, `mlx-community/whisper-large-v3-mlx`) into the HuggingFace cache (`~/.cache/huggingface/`). One-time cost.

### 2. Clone and symlink

Claude Code reads skills from `~/.claude/skills/` and slash commands from `~/.claude/commands/`. Clone once, then symlink each artifact you want:

```bash
git clone https://github.com/behagoras/behagoras-skills.git ~/git/projects/behagoras-skills

mkdir -p ~/.claude/skills ~/.claude/commands

# Skill
ln -s ~/git/projects/behagoras-skills/video-transcript ~/.claude/skills/video-transcript

# Slash commands
for cmd in youtube-transcript instagram-transcript tiktok-transcript video-transcript; do
  ln -s ~/git/projects/behagoras-skills/commands/${cmd}.md ~/.claude/commands/${cmd}.md
done
```

Or copy the folders/files directly if you prefer not to use symlinks.

### 3. (Optional) Point `--note` at your Obsidian vault

By default `--note` writes to `~/Documents/Vault/AI Notes/transcripts/`. To save into your own vault, add this to your shell rc:

```bash
export YT_TRANSCRIPT_VAULT="$HOME/path/to/your/obsidian-vault"
```

Or pass `--vault-dir <path>` per call.

## License

MIT — see [LICENSE](./LICENSE).
