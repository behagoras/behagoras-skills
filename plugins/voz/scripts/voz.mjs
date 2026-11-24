#!/usr/bin/env node
// voz: opt-in spoken summaries of agent replies for Claude Code, Codex, and Antigravity.
// One script serves three roles: the CLI the `voz` skill runs, the hook entry point,
// and the detached worker that summarizes a reply and renders it with macOS `say`.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const HARNESSES = ["claude", "codex", "antigravity"];
const SESSION_ENV = {
  claude: "CLAUDE_CODE_SESSION_ID",
  codex: "CODEX_THREAD_ID",
  antigravity: "ANTIGRAVITY_CONVERSATION_ID",
};
// Wrappers between an agent and the commands it runs; the agent is the first other ancestor.
const WRAPPERS = new Set(["sh", "bash", "zsh", "dash", "fish", "env", "timeout", "sandbox-exec"]);
const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;
const SUMMARIZER_TIMEOUT_MS = 90 * 1000;
const AUDIO_LINE = /^!\[[^\]]*\]\([^)]*\.m4a\)\s*$/gm;

const voiceHome = () => process.env.VOZ_HOME || join(homedir(), ".local", "share", "voz");
const retentionDays = () => Number(process.env.VOZ_RETENTION_DAYS || 14);
const conversationsDir = () => join(voiceHome(), "conversations");
const conversationDir = (key) => join(conversationsDir(), key);
const stateFile = (key) => join(conversationDir(key), "state.json");
const indexFile = () => join(voiceHome(), "index.jsonl");
const logFile = () => join(voiceHome(), "voz.log");

function safeId(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
}

// A T3 Code thread keeps its id when the user switches provider, so keying on it
// lets voice mode survive a handoff. Without T3, each agent session is its own key.
export function conversationKey(harness, sessionId, env = process.env) {
  if (env.T3CODE_THREAD_ID) return `t3-${safeId(env.T3CODE_THREAD_ID)}`;
  if (sessionId) return `${harness}-${safeId(sessionId)}`;
  return null;
}

function log(message) {
  try {
    mkdirSync(voiceHome(), { recursive: true });
    appendFileSync(logFile(), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // logging must never break a hook
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, file);
}

const loadState = (key) => readJson(stateFile(key), null);
const saveState = (key, state) => writeJson(stateFile(key), { ...state, updatedAt: Date.now() });

// Hooks from two agents can touch one conversation at the same moment (a handoff
// right after the previous turn ends). Each read-modify-write runs under a lock
// folder that records its holder's pid; mkdir is atomic. A lock whose holder has
// exited is broken. When the lock stays busy, the caller skips its update.
export const BUSY = Symbol("busy");

function holderAlive(lock) {
  const pid = Number(readFileSafe(join(lock, "pid")));
  if (!pid) return Date.now() - statSync(lock).mtimeMs < 10_000; // holder still writing its pid
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function withLock(key, fn) {
  mkdirSync(conversationDir(key), { recursive: true });
  const lock = join(conversationDir(key), ".lock");
  const deadline = Date.now() + 3000;
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, "pid"), String(process.pid));
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        if (!holderAlive(lock)) {
          const broken = `${lock}.${process.pid}.broken`;
          renameSync(lock, broken);
          rmSync(broken, { recursive: true, force: true });
          continue;
        }
      } catch {
        // another process released or broke it meanwhile
      }
      if (Date.now() > deadline) {
        log(`lock busy for ${key}; skipped an update`);
        return BUSY;
      }
      sleep(20);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

// Agent sandboxes (Codex workspace-write, for example) let the CLI write only to the
// project and temp folders. The CLI then leaves its change in a spool under /tmp,
// and the next hook, which runs outside the sandbox, applies it.
function spoolDirs() {
  const uid = typeof process.getuid === "function" ? process.getuid() : "user";
  return [process.env.VOZ_SPOOL || join("/tmp", `voz-${uid}`), join(tmpdir(), `voz-${uid}`)];
}

// /tmp is shared, so a spool folder counts only if this user owns it, it is a real
// folder, and no one else can write to it.
function privateDir(dir, create) {
  try {
    if (create) mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stats = lstatSync(dir);
    const mine = typeof process.getuid !== "function" || stats.uid === process.getuid();
    return stats.isDirectory() && mine && (stats.mode & 0o022) === 0;
  } catch {
    return false;
  }
}

function validPatch(key, patch) {
  const clean = {};
  if (typeof patch.active === "boolean") clean.active = patch.active;
  if (typeof patch.owner === "string" || patch.owner === null) clean.owner = patch.owner;
  for (const field of ["ownerPid", "activatedAt"]) if (Number.isFinite(patch[field]) || patch[field] === null) clean[field] = patch[field];
  const pending = patch.pending;
  const inside = typeof pending === "string" && dirname(pending) === conversationDir(key) && pending.endsWith(".m4a");
  if (pending === null || inside) clean.pending = pending;
  return clean;
}

function changeState(key, patch) {
  try {
    if (withLock(key, () => saveState(key, { ...(loadState(key) || {}), ...patch })) !== BUSY) return "saved";
  } catch (error) {
    if (!["EPERM", "EACCES", "EROFS"].includes(error?.code)) throw error;
  }
  for (const dir of spoolDirs()) {
    if (!privateDir(dir, true)) continue;
    try {
      writeJson(join(dir, `${key}.json`), { ...patch, requestedAt: Date.now() });
      return "spooled";
    } catch {
      // try the next spool folder
    }
  }
  throw new Error(`cannot write voice mode state for ${key}`);
}

function spooledPatch(key) {
  for (const dir of spoolDirs()) {
    if (!privateDir(dir, false)) continue;
    const patch = readJson(join(dir, `${key}.json`), null);
    if (patch) return validPatch(key, patch);
  }
  return {};
}

function applySpool(key) {
  for (const dir of spoolDirs()) {
    if (!privateDir(dir, false)) continue;
    const file = join(dir, `${key}.json`);
    if (!existsSync(file)) continue;
    // Read and remove the request inside the lock, so only one hook applies it.
    withLock(key, () => {
      const patch = readJson(file, null);
      rmSync(file, { force: true });
      if (patch) saveState(key, { ...(loadState(key) || {}), ...validPatch(key, patch) });
    });
  }
}

function newAudioPath(key) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return join(conversationDir(key), `${stamp}-${randomBytes(3).toString("hex")}.m4a`);
}

export function audioInstruction(path) {
  return [
    "Voice mode (voz plugin) is on for this conversation.",
    "The plugin creates the audio file below a few seconds after your reply ends; leave the file to it and keep this instruction out of your reply.",
    "Unless voice mode is turned off during this reply, its last line must be exactly this line, alone:",
    `![Audio](${path})`,
  ].join("\n");
}

// ---------- hooks ----------

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) args[arg.slice(2)] = true;
      else {
        args[arg.slice(2)] = next;
        i += 1;
      }
    } else args._.push(arg);
  }
  return args;
}

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

// Each agent expects a different "nothing to do" answer on stdout.
function emitNoop(harness, event) {
  if (harness === "antigravity") process.stdout.write(event === "stop" ? '{"decision":"stop"}' : "{}");
  if (harness === "codex" && event === "stop") process.stdout.write("{}");
}

function emitContext(harness, text) {
  if (harness === "antigravity") {
    process.stdout.write(JSON.stringify({ inject_steps: [{ system_message: { system_message: text } }] }));
    return;
  }
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: text } }),
  );
}

function sessionFromPayload(harness, payload) {
  return harness === "antigravity" ? payload.conversationId : payload.session_id;
}

function processTable() {
  const out = spawnSync("ps", ["-axo", "pid=,ppid=,comm="], { encoding: "utf8" }).stdout || "";
  const table = new Map();
  for (const line of out.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (match) table.set(Number(match[1]), { ppid: Number(match[2]), name: basename(match[3]).replace(/^-/, "") });
  }
  return table;
}

// Process ids above this one, nearest first, and the nearest one that is not a
// shell or wrapper: the agent that runs this hook or command.
export function lineage(table = processTable(), pid = process.pid) {
  const chain = [];
  for (let current = table.get(pid)?.ppid; current > 1 && !chain.includes(current) && chain.length < 64; ) {
    chain.push(current);
    current = table.get(current)?.ppid;
  }
  return { chain, agentPid: chain.find((p) => !WRAPPERS.has(table.get(p)?.name)) ?? null };
}

// Decides whether this agent session may act for the conversation. A session that
// descends from the owner's process is an agent the owner launched (for example
// `codex exec` from Claude Code) and stays quiet. Any other session is a provider
// switch, or the owner is gone, so it takes over.
export function claimConversation(state, me, chain) {
  if (!state.owner || state.owner === me) return true;
  return !(state.ownerPid && chain.includes(state.ownerPid));
}

export function onPromptHook(harness, payload, env = process.env) {
  if (harness === "antigravity" && Number(payload.invocationNum || 0) > 0) return null;
  const sessionId = sessionFromPayload(harness, payload);
  const key = conversationKey(harness, sessionId, env);
  if (!key) return null;
  applySpool(key);
  if (!loadState(key)?.active) return null;
  const me = `${harness}:${sessionId}`;
  const { chain, agentPid } = lineage();
  const path = withLock(key, () => {
    const state = loadState(key);
    if (!state?.active || !claimConversation(state, me, chain)) return null;
    const next = newAudioPath(key);
    saveState(key, { ...state, owner: me, ownerPid: agentPid, pending: next });
    return next;
  });
  return path && path !== BUSY ? audioInstruction(path) : null;
}

export function onStopHook(harness, payload, env = process.env) {
  pruneIfDue();
  const sessionId = sessionFromPayload(harness, payload);
  const key = conversationKey(harness, sessionId, env);
  if (!key) return null;
  applySpool(key);
  if (!loadState(key)?.active) return null;
  // Only the before-turn hook and "on" change the owner. A late Stop from a previous
  // owner must not take back a turn that a new agent has already announced.
  const me = `${harness}:${sessionId}`;
  const pending = withLock(key, () => {
    const state = loadState(key);
    if (!state?.active || state.owner !== me) return null;
    saveState(key, { ...state, pending: null });
    return state.pending;
  });
  if (!pending || pending === BUSY) return null;

  const reply = payload.last_assistant_message;
  if (typeof reply === "string" && !reply.includes(pending)) {
    log(`skip ${key}: the reply did not include its audio line`);
    return null;
  }
  const job = {
    key,
    harness,
    session: sessionId,
    cwd: payload.cwd || (payload.workspacePaths || [])[0] || process.cwd(),
    out: pending,
    reply: typeof reply === "string" ? reply : null,
    transcript: payload.transcriptPath || null,
  };
  const jobFile = `${pending}.job.json`;
  writeJson(jobFile, job);
  const child = spawn(process.execPath, [SCRIPT, "render", "--job", jobFile], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, VOZ_INNER: "1" },
  });
  child.unref();
  return job;
}

function runHook(event, harness) {
  if (!HARNESSES.includes(harness)) return;
  if (process.env.VOZ_DEBUG) log(`hook ${event} ${harness}${process.env.VOZ_INNER ? " (inner)" : ""}`);
  if (process.env.VOZ_INNER) return emitNoop(harness, event);
  const payload = readStdin();
  try {
    if (event === "prompt") {
      const text = onPromptHook(harness, payload);
      return text ? emitContext(harness, text) : emitNoop(harness, event);
    }
    if (event === "stop") onStopHook(harness, payload);
  } catch (error) {
    log(`hook ${event} ${harness} failed: ${error?.stack || error}`);
  }
  emitNoop(harness, event);
}

// ---------- worker ----------

export function plainText(markdown) {
  const text = markdown
    .replace(AUDIO_LINE, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/[*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= 1500) return text;
  const cut = text.slice(0, 1500);
  const end = cut.lastIndexOf(". ");
  return end > 500 ? cut.slice(0, end + 1) : cut;
}

export function summaryPrompt(reply) {
  return [
    "Rewrite the assistant reply below as a short script for a text-to-speech voice.",
    "- Write in the same language as the reply.",
    "- Use at most 120 words of plain sentences.",
    "- Keep decisions, results, numbers, and any question for the listener.",
    "- Leave out code, tables, file paths, URLs, and Markdown.",
    "- Output only the script.",
    "",
    "<reply>",
    reply,
    "</reply>",
  ].join("\n");
}

// Cheap model per agent, chosen by the user: Haiku, Luna, and Gemini Neon Low.
function summarizerCommand(harness, prompt, outFile) {
  if (harness === "claude") {
    return {
      bin: "claude",
      args: ["-p", "--model", "haiku", "--effort", "medium", "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands", "--tools", ""],
      input: prompt,
    };
  }
  if (harness === "codex") {
    return {
      bin: "codex",
      args: ["exec", "--ignore-user-config", "-m", "gpt-6-luna", "-c", "model_reasoning_effort=medium", "--ephemeral", "--skip-git-repo-check", "-s", "read-only", "-o", outFile, "-"],
      input: prompt,
      readOut: true,
    };
  }
  return {
    bin: "agy",
    args: ["--model", "gemini-4-neon-low", "--print-timeout", "80s", "-p", prompt],
    input: "",
  };
}

function summarize(harness, reply, workDir) {
  const outFile = join(workDir, `summary-${process.pid}.txt`);
  const command = summarizerCommand(harness, summaryPrompt(reply), outFile);
  const result = spawnSync(command.bin, command.args, {
    input: command.input,
    cwd: tmpdir(),
    encoding: "utf8",
    timeout: SUMMARIZER_TIMEOUT_MS,
    env: { ...process.env, VOZ_INNER: "1" },
  });
  let text = command.readOut ? readFileSafe(outFile) : result.stdout;
  rmSync(outFile, { force: true });
  text = (text || "").trim();
  if (result.status !== 0 || !text) {
    log(`summarizer ${command.bin} failed (status ${result.status}): ${(result.stderr || result.error || "").toString().slice(0, 300)}`);
    return null;
  }
  return text;
}

function readFileSafe(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

// Antigravity does not pass the reply to its Stop hook, so the worker reads the
// last model step from the transcript. It can lag a moment behind the hook.
export function replyFromTranscript(file, audioPath) {
  const lines = readFileSafe(file).trim().split("\n").reverse();
  for (const line of lines) {
    try {
      const step = JSON.parse(line);
      if (step.source === "MODEL" && step.type === "PLANNER_RESPONSE" && step.content?.includes(audioPath)) return step.content;
    } catch {
      // skip partial lines
    }
  }
  return null;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function render(jobFile) {
  const job = readJson(jobFile, null);
  if (!job) return;
  const started = Date.now();
  try {
    let reply = job.reply;
    for (let attempt = 0; !reply && job.transcript && attempt < 10; attempt += 1) {
      reply = replyFromTranscript(job.transcript, job.out);
      if (!reply) sleep(1000);
    }
    if (!reply) return log(`render ${job.key}: no reply text found`);
    if (!reply.includes(job.out)) return log(`skip ${job.key}: the reply did not include its audio line`);

    const workDir = dirname(job.out);
    const cleaned = reply.replace(AUDIO_LINE, "").trim();
    let script = summarize(job.harness, cleaned, workDir);
    const summarizer = script ? job.harness : "fallback";
    script ||= plainText(cleaned);

    const textFile = `${job.out}.txt`;
    const tmpAudio = `${job.out}.part.m4a`;
    writeFileSync(textFile, script);
    const say = spawnSync(
      process.env.VOZ_SAY || "say",
      ["-v", process.env.VOZ_VOICE || "Paulina", "-r", process.env.VOZ_RATE || "185", "-f", textFile, "-o", tmpAudio, "--file-format=m4af", "--data-format=aac"],
      { encoding: "utf8", timeout: 120 * 1000 },
    );
    rmSync(textFile, { force: true });
    if (say.status !== 0 || !existsSync(tmpAudio)) {
      rmSync(tmpAudio, { force: true });
      return log(`say failed for ${job.key}: ${(say.stderr || say.error || "").toString().slice(0, 300)}`);
    }
    renameSync(tmpAudio, job.out);
    appendFileSync(
      indexFile(),
      `${JSON.stringify({
        createdAt: new Date().toISOString(),
        conversation: job.key,
        harness: job.harness,
        session: job.session,
        cwd: job.cwd,
        file: job.out,
        summarizer,
        seconds: Math.round((Date.now() - started) / 1000),
      })}\n`,
    );
  } finally {
    rmSync(jobFile, { force: true });
  }
}

// ---------- cleanup ----------

function audioFiles() {
  if (!existsSync(conversationsDir())) return [];
  return readdirSync(conversationsDir()).flatMap((key) => {
    const dir = conversationDir(key);
    return readdirSync(dir)
      .filter((name) => name.endsWith(".m4a") && !name.endsWith(".part.m4a"))
      .flatMap((name) => {
        const file = join(dir, name);
        try {
          const stats = statSync(file);
          return [{ key, file, bytes: stats.size, mtime: stats.mtimeMs }];
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
          return []; // deleted while we listed it
        }
      });
  });
}

// A render takes seconds; job, partial audio, and text files older than this were abandoned.
const ABANDONED_MS = 60 * 60 * 1000;

export function clean({ days, key, all } = {}) {
  const cutoff = Date.now() - (days ?? retentionDays()) * 24 * 60 * 60 * 1000;
  const doomed = audioFiles().filter((a) => all || (key ? a.key === key : a.mtime < cutoff));
  for (const audio of doomed) rmSync(audio.file, { force: true });

  // Drop conversation folders with no audio left that are off, or on but idle past retention.
  if (existsSync(conversationsDir())) {
    for (const name of readdirSync(conversationsDir())) {
      const dir = conversationDir(name);
      for (const file of readdirSync(dir)) {
        const leftover = /\.(job\.json|part\.m4a|m4a\.txt)$|^summary-\d+\.txt$|^\.lock$/.test(file);
        try {
          if (leftover && statSync(join(dir, file)).mtimeMs < Date.now() - ABANDONED_MS) rmSync(join(dir, file), { recursive: true, force: true });
        } catch (error) {
          if (error?.code !== "ENOENT") throw error; // ENOENT: a finishing worker removed it first
        }
      }
      // Anything besides state.json is audio or a render still in progress.
      const busy = readdirSync(dir).some((f) => f !== "state.json");
      const state = loadState(name);
      if (!busy && (!state?.active || (state.updatedAt || 0) < cutoff)) rmSync(dir, { recursive: true, force: true });
    }
  }

  const kept = readFileSafe(indexFile())
    .split("\n")
    .filter((line) => {
      try {
        return existsSync(JSON.parse(line).file);
      } catch {
        return false;
      }
    });
  if (existsSync(indexFile())) writeFileSync(indexFile(), kept.length ? `${kept.join("\n")}\n` : "");
  return { files: doomed.length, bytes: doomed.reduce((sum, a) => sum + a.bytes, 0) };
}

function pruneIfDue() {
  const stamp = join(voiceHome(), ".last-prune");
  if (!existsSync(voiceHome())) return;
  try {
    if (existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < PRUNE_EVERY_MS) return;
    clean({});
    writeFileSync(stamp, "");
    utimesSync(stamp, new Date(), new Date());
  } catch (error) {
    log(`prune failed: ${error?.message || error}`);
  }
}

// ---------- CLI ----------

function cliSession(args) {
  const harness = HARNESSES.includes(args.harness) ? args.harness : null;
  const sessionId = harness ? process.env[SESSION_ENV[harness]] : null;
  return { key: conversationKey(harness, sessionId), owner: sessionId ? `${harness}:${sessionId}` : null };
}

const cliKey = (args) => cliSession(args).key;

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function handoffNote(key) {
  return key.startsWith("t3-")
    ? "In T3 Code it follows this thread through a provider switch (handoff), in every agent that has the voz plugin installed: Claude Code, Codex, or Antigravity."
    : "It applies to this conversation only. In T3 Code, voice mode also follows the thread through a provider switch.";
}

function cli(argv) {
  const args = parseArgs(argv);
  const [command] = args._;

  if (command === "hook") return runHook(args._[1], args.harness);
  if (command === "render") return render(args.job);

  if (command === "on" || command === "off" || command === "status") {
    const { key, owner } = cliSession(args);
    if (!key) {
      console.log("Could not identify this conversation. Run this from inside the agent and pass --harness claude, codex, or antigravity.");
      process.exitCode = 1;
      return;
    }
    const state = { ...(loadState(key) || {}), ...spooledPatch(key) };
    const spoolNote = (how) => (how === "spooled" ? " The agent sandbox blocked the state folder, so the change applies when this reply ends." : "");
    if (command === "on") {
      if (!owner) {
        console.log("Pass --harness claude, codex, or antigravity so voice mode knows which session owns this conversation.");
        process.exitCode = 1;
        return;
      }
      // The prompt hook already ran inactive for this turn, so the CLI hands out
      // this turn's audio path. A repeated "on" in the same turn keeps the same path.
      const path = state.active && state.owner === owner && state.pending ? state.pending : newAudioPath(key);
      const how = changeState(key, { active: true, activatedAt: Date.now(), owner, ownerPid: lineage().agentPid, pending: path });
      console.log(
        [
          `Voice mode is on (conversation ${key}).${spoolNote(how)}`,
          "Tell the user, in their language:",
          "- Each reply now ends with an audio summary that appears a few seconds after the text.",
          `- ${handoffNote(key)}`,
          `- Audio is kept for ${retentionDays()} days in ${voiceHome()}; ask to turn voice mode off, or to clean the audio, at any time.`,
          "",
          audioInstruction(path),
        ].join("\n"),
      );
      return;
    }
    if (command === "off") {
      const how = changeState(key, { active: false, pending: null });
      console.log(`Voice mode is off (conversation ${key}).${spoolNote(how)} Leave this reply's audio line out. Its audio stays until cleanup after ${retentionDays()} days; run "clean --current" to delete it now.`);
      return;
    }
    const mine = audioFiles().filter((a) => a.key === key);
    console.log(
      `Voice mode is ${state.active ? "on" : "off"} (conversation ${key}). ${mine.length} audio files, ${mb(mine.reduce((s, a) => s + a.bytes, 0))}, in ${conversationDir(key)}.`,
    );
    return;
  }

  if (command === "clean") {
    const key = args.current ? cliKey(args) : args.conversation ? safeId(args.conversation) : undefined;
    if (args.current && !key) {
      console.log("Could not identify this conversation; pass --harness.");
      process.exitCode = 1;
      return;
    }
    const days = args.days === undefined ? undefined : Number(args.days);
    try {
      const result = clean({ days, key, all: Boolean(args.all) });
      console.log(`Deleted ${result.files} audio files (${mb(result.bytes)}).`);
    } catch (error) {
      if (!["EPERM", "EACCES", "EROFS"].includes(error?.code)) throw error;
      console.log(`The agent sandbox blocked deleting files in ${voiceHome()}. Ask the user to approve running this command outside the sandbox.`);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "list") {
    const byKey = new Map();
    for (const audio of audioFiles()) {
      const entry = byKey.get(audio.key) || { files: 0, bytes: 0, last: 0 };
      entry.files += 1;
      entry.bytes += audio.bytes;
      entry.last = Math.max(entry.last, audio.mtime);
      byKey.set(audio.key, entry);
    }
    if (!byKey.size) return console.log(`No audio in ${voiceHome()}.`);
    for (const [key, entry] of byKey) {
      const active = loadState(key)?.active ? "on " : "off";
      console.log(`${active} ${key}  ${entry.files} files  ${mb(entry.bytes)}  last ${new Date(entry.last).toISOString().slice(0, 16)}`);
    }
    return;
  }

  console.log(
    [
      "Usage: voz.mjs <command> [--harness claude|codex|antigravity]",
      "  on | off | status     Turn voice mode on or off for this conversation, or show it.",
      "  list                  Show every conversation that has audio.",
      "  clean                 Delete audio older than the retention period (default 14 days).",
      "  clean --days N        Delete audio older than N days.",
      "  clean --current       Delete this conversation's audio.",
      "  clean --conversation K  Delete one conversation's audio.",
      "  clean --all           Delete all audio.",
    ].join("\n"),
  );
}

if (process.argv[1] === SCRIPT) cli(process.argv.slice(2));
