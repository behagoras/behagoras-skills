# behagoras-skills

A collection of [Claude Code Skills](https://docs.claude.com/en/docs/claude-code/skills) maintained by [@behagoras](https://github.com/behagoras), distributed as a single npm package with a CLI installer.

```bash
npx behagoras-skills install
```

That one command symlinks every selected skill (and its slash commands) into `~/.claude/`, walks you through any per-skill configuration, and verifies the system dependencies. Re-running it is a no-op for anything already in place.

## Skills

| Skill | One-liner install |
|---|---|
| [`video-transcript`](./video-transcript/README.md) — extract transcripts from any video URL (YouTube, Reels, TikTok, Vimeo, …) | `npx behagoras-skills install video-transcript` |

## Slash commands

Discoverability aliases that all delegate to the `video-transcript` skill — they differ only in the URL validation they apply.

| Command | Use for |
|---|---|
| [`/youtube-transcript <url>`](./commands/youtube-transcript.md) | YouTube videos, Shorts, and live URLs |
| [`/instagram-transcript <url>`](./commands/instagram-transcript.md) | Instagram Reels and posts |
| [`/tiktok-transcript <url>`](./commands/tiktok-transcript.md) | TikTok videos |
| [`/video-transcript <url>`](./commands/video-transcript.md) | Generic — anything `yt-dlp` supports |

## CLI commands

```
$ npx behagoras-skills <subcommand>
```

| Subcommand | What it does |
|---|---|
| `install [skill]` | Install one skill, or all selected via an interactive checkbox menu when no name is given. Idempotent. |
| `list` | Print every skill and its installation status (`installed`, `not installed`, `broken-symlink`, `installed-elsewhere`). |
| `uninstall <skill>` | Remove the symlinks created by install. Leaves your clone, `.transcriptsrc`, and skill folder alone. |
| `doctor` | Verify required binaries and symlinks for installed skills. Exits 0 when all hard requirements pass. |
| `update` | Git-clone path: `git pull` + reinstall deps. npx path: prints the `@latest` reinvocation hint. |

Common flags (work on every subcommand):

- `--yes` — skip prompts; use declared defaults.
- `--scope global|local` — default `global` (`~/.claude/`); `local` writes into `<cwd>/.claude/`.
- `--repo-root <path>` — override the package install location (development).
- `--force` — on `install`, overwrite divergent symlinks and replace existing rc files.

## Configuration — `.transcriptsrc`

The `video-transcript` skill is driven by a small config file. Drop a `.transcriptsrc` at the root of any project (or in `$HOME` for a global default) and the skill will pick it up automatically. The CLI's `install` walks you through generating one.

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

## Development

Local hacking on the CLI:

```bash
git clone https://github.com/behagoras/behagoras-skills.git
cd behagoras-skills
pnpm install
pnpm build         # tsup → cli/dist/index.js (with shebang)
node ./cli/dist/index.js list
node ./cli/dist/index.js install video-transcript --repo-root "$PWD"
```

Adding a new skill: create the folder under `<repo>/`, add a `SKILL.md` and a thin `README.md`, drop any slash command files into `<repo>/commands/`, then add a `skills.json` entry for it. The CLI source itself does NOT need to change — `skills.json` is the source of truth.

Run the type checker without emitting:

```bash
pnpm lint
```

Validate the manifest against its JSON Schema:

```bash
node -e "const Ajv=require('ajv').default; const a=new Ajv(); const v=a.compile(require('./skills.schema.json')); if(!v(require('./skills.json'))) {console.error(v.errors); process.exit(1)}"
```

<details>
<summary><b>Manual install (without Node or npm)</b></summary>

If you cannot install Node, you can still wire up the skill by hand.

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

**3. (Optional) Bash bootstrap.** With Node available, `bash install.sh` simply proxies to `npx behagoras-skills@latest install` — no separate flow.

</details>

## License

MIT — see [LICENSE](./LICENSE).
