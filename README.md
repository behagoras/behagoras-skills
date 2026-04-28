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

### Quick install (interactive)

```bash
git clone https://github.com/behagoras/behagoras-skills.git ~/git/projects/behagoras-skills
cd ~/git/projects/behagoras-skills
bash install.sh
```

`install.sh` walks you through:
1. Symlink scope — global (`~/.claude/`) or none.
2. Whether to drop a `.transcriptsrc` in the current directory and which `vault_dir` it should point at.
3. Verifying system dependencies and printing the right install commands for missing ones.

The script is idempotent — re-running it skips anything already in place.

### Manual install

If you'd rather not run a script:

**1. System dependencies.** The skill needs `yt-dlp`, `ffmpeg`, Python 3.9+, and (for the audio fallback) `mlx-whisper`.

```bash
# macOS (Apple Silicon — full functionality)
brew install yt-dlp ffmpeg pipx
pipx ensurepath
pipx install mlx-whisper
```

> **macOS Intel / Linux / Windows:** the captions path works fine, but the audio fallback (used when a video has no captions — Reels, TikToks, etc.) requires `mlx-whisper`, which is **Apple Silicon only**. Either stick to URLs with captions, or swap the `mlx_whisper` invocation in `scripts/transcribe.sh` for [`whisper.cpp`](https://github.com/ggerganov/whisper.cpp) / OpenAI / Groq.

> **First audio run** downloads the Whisper model (~3GB, `mlx-community/whisper-large-v3-mlx`) into `~/.cache/huggingface/`. One-time cost.

**2. Clone and symlink.** Claude Code reads skills from `~/.claude/skills/` and slash commands from `~/.claude/commands/`:

```bash
git clone https://github.com/behagoras/behagoras-skills.git ~/git/projects/behagoras-skills
mkdir -p ~/.claude/skills ~/.claude/commands
ln -s ~/git/projects/behagoras-skills/video-transcript ~/.claude/skills/video-transcript
for cmd in youtube-transcript instagram-transcript tiktok-transcript video-transcript; do
  ln -s ~/git/projects/behagoras-skills/commands/${cmd}.md ~/.claude/commands/${cmd}.md
done
```

## Configuration — `.transcriptsrc`

The `video-transcript` skill is driven by a small config file. Drop a `.transcriptsrc` at the root of any project (or in `$HOME` for a global default) and the skill will pick it up automatically.

**Lookup order.** When the skill runs, it walks up from the current working directory looking for a `.transcriptsrc`. The first one found wins. If none is found in any ancestor, it falls back to `~/.transcriptsrc`. If neither exists, the default vault is `./.transcripts/` in the current directory.

**Recognized keys** (see [`.transcriptsrc.example`](./.transcriptsrc.example)):

| Key | Default | Meaning |
|---|---|---|
| `vault_dir` | `./.transcripts` | Where `--note` saves the markdown copy. Relative paths anchor to the `.transcriptsrc` location, **not** CWD. `~` and `$HOME` are expanded. |
| `default_with_timestamps` | `false` | If `true`, behaves as if `--timestamps` were passed every time. |
| `default_force_audio` | `false` | If `true`, behaves as if `--force-audio` were passed every time. |

**Parsing is strict.** Only those three keys are read; arbitrary shell in the file is **not** executed. Cloning a repo that ships a `.transcriptsrc` is therefore safe — the worst it can do is point your transcripts at a different folder.

**Vault precedence** (highest wins):

1. `--vault-dir <path>` flag on the call
2. `YT_TRANSCRIPT_VAULT` env var
3. `vault_dir` from the nearest `.transcriptsrc`
4. `./.transcripts/` (CWD-relative default)

**Example — per-project vault.** A repo whose vault lives at `./vault/`:

```
# repo-root/.transcriptsrc
vault_dir=./vault
```

Now any `transcribe.sh ... --note` invocation from inside that repo writes to `repo-root/vault/AI Notes/transcripts/...`.

## License

MIT — see [LICENSE](./LICENSE).
