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

Claude Code reads skills from `~/.claude/skills/` and slash commands from `~/.claude/commands/`. Clone the repo once, then symlink each artifact you want:

```bash
git clone https://github.com/behagoras/behagoras-skills.git ~/git/projects/behagoras-skills

# Skill
ln -s ~/git/projects/behagoras-skills/video-transcript ~/.claude/skills/video-transcript

# Slash commands
for cmd in youtube-transcript instagram-transcript tiktok-transcript video-transcript; do
  ln -s ~/git/projects/behagoras-skills/commands/${cmd}.md ~/.claude/commands/${cmd}.md
done
```

Or copy the folders/files directly if you prefer not to use symlinks.

## Per-skill requirements

Each skill's `SKILL.md` documents what's required at runtime. Common system dependencies referenced across these skills:

- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) — video URL fetching
- [`ffmpeg`](https://ffmpeg.org/) — audio extraction
- [`mlx-whisper`](https://github.com/ml-explore/mlx-examples/tree/main/whisper) — local audio transcription on Apple Silicon (`pipx install mlx-whisper`)

## License

MIT — see [LICENSE](./LICENSE).
