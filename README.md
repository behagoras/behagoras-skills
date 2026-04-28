# behagoras-skills

A collection of [Claude Code Skills](https://docs.claude.com/en/docs/claude-code/skills) maintained by [@behagoras](https://github.com/behagoras).

Skills are self-contained capabilities that Claude can discover and apply to specific tasks. Each folder under this repo is one skill.

## Skills

| Skill | Description |
|---|---|
| [`video-transcript`](./video-transcript/) | Extract transcripts from any video URL — YouTube, Shorts, Instagram Reels, TikTok, and 1800+ other sites via `yt-dlp`, with local Whisper fallback for videos without captions. |

## Installing a skill

Claude Code reads skills from `~/.claude/skills/`. To install one of these skills, symlink it from the repo into that directory:

```bash
git clone https://github.com/behagoras/behagoras-skills.git ~/git/projects/behagoras-skills
ln -s ~/git/projects/behagoras-skills/video-transcript ~/.claude/skills/video-transcript
```

Or copy the folder directly if you prefer:

```bash
cp -R ~/git/projects/behagoras-skills/video-transcript ~/.claude/skills/
```

## Per-skill requirements

Each skill's `SKILL.md` documents what's required at runtime. Common system dependencies referenced across these skills:

- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) — video URL fetching
- [`ffmpeg`](https://ffmpeg.org/) — audio extraction
- [`mlx-whisper`](https://github.com/ml-explore/mlx-examples/tree/main/whisper) — local audio transcription on Apple Silicon (`pipx install mlx-whisper`)

## License

MIT — see [LICENSE](./LICENSE).
