# behagoras-skills

A collection of [Claude Code Skills](https://docs.claude.com/en/docs/claude-code/skills) maintained by [@behagoras](https://github.com/behagoras), distributed as a single npm package with a CLI installer.

```bash
npx behagoras-skills install
```

That one command symlinks every selected skill (and its slash commands) into `~/.claude/`, walks you through any per-skill configuration, and verifies the system dependencies. Re-running it is a no-op for anything already in place.

## Skills

| Skill | One-liner install |
|---|---|
| [`b7s-brainstorm`](./b7s-brainstorm/README.md) — freestyle brainstorm capture (Mexican Spanish), saves to `.brainstorms/inbox/` | `npx behagoras-skills install b7s-brainstorm` |
| [`b7s-create-skill`](./b7s-create-skill/README.md) — mnemonic shortcut to `/skill-creator` | `npx behagoras-skills install b7s-create-skill` |
| [`b7s-daily-dump`](./b7s-daily-dump/README.md) — discoverability alias for `b7s-brainstorm` | `npx behagoras-skills install b7s-daily-dump` |
| [`b7s-info-dump`](./b7s-info-dump/README.md) — discoverability alias for `b7s-brainstorm` | `npx behagoras-skills install b7s-info-dump` |
| [`b7s-lluvia`](./b7s-lluvia/README.md) — discoverability alias for `b7s-brainstorm` (Spanish phrasing) | `npx behagoras-skills install b7s-lluvia` |
| [`b7s-prioritize`](./b7s-prioritize/README.md) — rank executable prompts by urgency, deps, and TODO coverage (closes the b7s trio) | `npx behagoras-skills install b7s-prioritize` |
| [`b7s-review`](./b7s-review/README.md) — review brainstorm TODOs and move files between status folders | `npx behagoras-skills install b7s-review` |
| [`video-transcript`](./video-transcript/README.md) — extract transcripts from any video URL (YouTube, Reels, TikTok, Vimeo, …) | `npx behagoras-skills install video-transcript` |

> The `b7s-*` skills are personal-use skills authored in Mexican Spanish; their `SKILL.md` bodies stay in Spanish even though the README and CLI surface remain in English.

## Slash commands

| Command | Use for |
|---|---|
| [`/b7s-brainstorm [topic]`](./commands/b7s-brainstorm.md) | Freestyle brainstorm capture (Spanish) |
| [`/b7s-review [date]`](./commands/b7s-review.md) | Review brainstorm TODOs and shuffle file statuses |
| [`/b7s-prioritize [N\|slug]`](./commands/b7s-prioritize.md) | Rank executable prompts by urgency, deps, and TODO coverage |
| [`/b7s-lluvia [topic]`](./commands/b7s-lluvia.md) | Alias of `/b7s-brainstorm` — triggers on "lluvia" |
| [`/b7s-daily-dump [topic]`](./commands/b7s-daily-dump.md) | Alias of `/b7s-brainstorm` — triggers on "daily dump" |
| [`/b7s-info-dump [topic]`](./commands/b7s-info-dump.md) | Alias of `/b7s-brainstorm` — triggers on "info dump" |
| [`/b7s-create-skill [desc]`](./commands/b7s-create-skill.md) | Mnemonic shortcut to `/skill-creator` |
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
| `update` | Reconcile installed skills with the current manifest (incremental sync — never blows away `.transcriptsrc`). Flags: `--clean` (destructive uninstall+reinstall), `--prune` (remove symlinks for commands no longer in the manifest). |

Common flags (work on every subcommand):

- `--yes` — skip prompts; use declared defaults.
- `--scope global|local` — default `global` (`~/.claude/`); `local` writes into `<cwd>/.claude/`.
- `--repo-root <path>` — override the package install location (development).
- `--force` — on `install`, overwrite divergent symlinks and replace existing rc files.

## Linux setup

The skill is first-class on Linux. The installer wires symlinks the same way as on macOS; only the system dependencies and the audio-fallback backend differ.

**1. System dependencies.**

```bash
sudo apt update && sudo apt install -y ffmpeg pipx
pipx ensurepath  # adds ~/.local/bin to PATH; restart shell or source ~/.bashrc
pipx install yt-dlp
pipx install whisper-ctranslate2  # optional, enables audio fallback
```

`apt`'s `yt-dlp` is typically stale — `pipx` keeps each tool in its own venv (Ubuntu 24.04+ enforces PEP 668, blocking a global `pip install`).

**2. Disk-footprint expectations.**

The `whisper-ctranslate2` audio path uses the `small` int8 model (~250MB), downloaded on first audio-path run and cached under `~/.cache/huggingface/`. Subsequent runs reuse the cache. The CLI is built on `faster-whisper` (the underlying CTranslate2 inference library); we install the wrapper because the bare `faster-whisper` PyPI package ships only a Python API. Downloaded audio files (`audio.m4a`, `audio.opus`, etc.) are deleted automatically after the transcript is written — pass `--keep-audio` to keep them, e.g. when re-running with a different `--lang` flag without re-downloading.

**3. Verify.**

```bash
npx behagoras-skills doctor
```

On Linux, doctor checks the same required binaries as on macOS (`yt-dlp`, `ffmpeg`, `python3`) and lists `whisper-ctranslate2` as the optional audio-fallback backend. `mlx_whisper` is platform-gated to macOS and not shown.

## macOS setup

```bash
brew install ffmpeg yt-dlp pipx
pipx ensurepath
pipx install mlx-whisper  # optional, enables audio fallback (Apple Silicon only)
```

The audio path uses `mlx_whisper` with the `large-v3` model. First audio-path run downloads ~3GB into `~/.cache/huggingface/`.

## Updating

```bash
npx behagoras-skills update              # incremental sync (default)
npx behagoras-skills update --prune      # also remove symlinks for commands no longer in the manifest
npx behagoras-skills update --clean      # destructive: uninstall+reinstall (rare)
```

The default mode is non-destructive: existing `.transcriptsrc` keys are preserved verbatim, divergent symlinks (e.g. left over from a previous npx tmp install) get re-pointed at the current location, and newly-declared commands or rcfile keys are added. Use `--clean` only when a normal update fails or you're migrating to a different scope.

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

**1. System dependencies.** The skill needs `yt-dlp`, `ffmpeg`, Python 3.9+, and (for the audio fallback) a whisper backend matched to your platform.

```bash
# macOS (Apple Silicon)
brew install yt-dlp ffmpeg pipx
pipx ensurepath
pipx install mlx-whisper

# Linux (Debian/Ubuntu)
sudo apt update && sudo apt install -y ffmpeg pipx
pipx ensurepath
pipx install yt-dlp
pipx install whisper-ctranslate2
```

> **Backend selection is automatic** — `transcribe.sh` detects the OS via `uname -s`. macOS uses `mlx_whisper` (Apple Silicon, large-v3, ~3GB model); Linux uses `whisper-ctranslate2` (small int8, ~250MB model — built on `faster-whisper`). Models are downloaded on first audio-path run into `~/.cache/huggingface/`.

> **macOS Intel / Windows:** the captions path works fine; the audio fallback is unsupported. Stick to URLs with captions or invoke a remote whisper service yourself.

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

## Releasing

Releases are automated by `.github/workflows/release.yml`. To ship a new version:

1. Open a PR.
2. Add **one** of these labels to the PR:
   - `release:patch` — bug fixes (0.0.x)
   - `release:minor` — new features, backwards-compatible (0.x.0)
   - `release:major` — breaking changes (x.0.0)
   - `skip-release` (or no release label) — no publish; the workflow no-ops
3. Merge the PR.

The workflow bumps `package.json`, pushes the version commit + tag, publishes to npm, creates a GitHub Release with auto-generated notes, and smoke-tests `npx behagoras-skills@<new-version> --version`.

If the smoke test fails or you need to roll back, contact npm support — `npm unpublish` is restricted to versions <72 hours old and may break downstream installs.

## License

MIT — see [LICENSE](./LICENSE).
