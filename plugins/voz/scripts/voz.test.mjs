import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "voz.mjs");

// Fake `say` copies its text into the audio file, so a test can read what was spoken.
const FAKES = {
  say: '#!/bin/sh\nwhile [ $# -gt 0 ]; do case "$1" in -f) in="$2"; shift 2;; -o) out="$2"; shift 2;; *) shift;; esac; done\ncp "$in" "$out"\n',
  claude: '#!/bin/sh\n[ -n "$FAKE_FAIL" ] && exit 1\ncat >/dev/null\necho "resumen de claude"\n',
  codex: '#!/bin/sh\nwhile [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; *) shift;; esac; done\ncat >/dev/null\necho "resumen de codex" > "$out"\n',
  agy: '#!/bin/sh\necho "resumen de antigravity"\n',
};

function setup() {
  const root = mkdtempSync(join(tmpdir(), "voz-test-"));
  const bin = join(root, "bin");
  mkdirSync(bin);
  for (const [name, body] of Object.entries(FAKES)) {
    writeFileSync(join(bin, name), body);
    chmodSync(join(bin, name), 0o755);
  }
  const env = {
    PATH: `${bin}:${process.env.PATH}`,
    HOME: root,
    VOZ_HOME: join(root, "voz"),
    T3CODE_THREAD_ID: "thread-1",
  };
  return { root, env };
}

function run(args, { env, stdin = "" }) {
  const result = spawnSync(process.execPath, [script, ...args], { input: stdin, encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const hook = (event, harness, payload, env) =>
  run(["hook", event, "--harness", harness], { env, stdin: JSON.stringify(payload) });

const pathFrom = (text) => text.match(/!\[Audio\]\(([^)]+)\)/)?.[1];

function waitFor(file, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (existsSync(file)) return true;
    spawnSync("sleep", ["0.1"]);
  }
  return false;
}

function state(env, key = "t3-thread-1") {
  return JSON.parse(readFileSync(join(env.VOZ_HOME, "conversations", key, "state.json"), "utf8"));
}

test("hooks stay silent while voice mode is off", () => {
  const { env } = setup();
  assert.equal(hook("prompt", "claude", { session_id: "a", prompt: "hi" }, env), "");
  assert.equal(hook("stop", "codex", { session_id: "a", last_assistant_message: "hi" }, env), "{}");
  assert.equal(hook("prompt", "antigravity", { conversationId: "a", invocationNum: 0 }, env), "{}");
  assert.equal(hook("stop", "antigravity", { conversationId: "a" }, env), '{"decision":"stop"}');
  assert.equal(existsSync(join(env.VOZ_HOME, "conversations")), false);
});

test("on, then a full Claude turn renders a summary at the announced path", () => {
  const { env } = setup();
  const onOut = run(["on", "--harness", "claude"], { env: { ...env, CLAUDE_CODE_SESSION_ID: "a" } });
  assert.match(onOut, /Voice mode is on/);
  assert.match(onOut, /provider switch/);
  const first = pathFrom(onOut);
  hook("stop", "claude", { session_id: "a", cwd: "/tmp", last_assistant_message: `Hecho.\n![Audio](${first})` }, env);
  assert.ok(waitFor(first), "activation turn audio");
  assert.equal(readFileSync(first, "utf8").trim(), "resumen de claude");

  const ctx = JSON.parse(hook("prompt", "claude", { session_id: "a", prompt: "sigue" }, env));
  const second = pathFrom(ctx.hookSpecificOutput.additionalContext);
  assert.notEqual(second, first);
  hook("stop", "claude", { session_id: "a", last_assistant_message: `Listo.\n![Audio](${second})` }, env);
  assert.ok(waitFor(second));
  const index = readFileSync(join(env.VOZ_HOME, "index.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(index.length, 2);
  assert.deepEqual([index[1].conversation, index[1].harness, index[1].summarizer], ["t3-thread-1", "claude", "claude"]);
});

test("a provider switch in the same T3 thread keeps voice mode on", () => {
  const { env } = setup();
  run(["on", "--harness", "claude"], { env: { ...env, CLAUDE_CODE_SESSION_ID: "a" } });
  hook("stop", "claude", { session_id: "a", last_assistant_message: "sin audio" }, env);
  const out = JSON.parse(hook("prompt", "codex", { session_id: "b", prompt: "hola" }, env));
  const path = pathFrom(out.hookSpecificOutput.additionalContext);
  assert.equal(state(env).owner, "codex:b");
  hook("stop", "codex", { session_id: "b", last_assistant_message: `ok\n![Audio](${path})` }, env);
  assert.ok(waitFor(path));
  assert.equal(readFileSync(path, "utf8").trim(), "resumen de codex");
});

test("an agent launched during the owner's turn stays quiet", () => {
  const { env } = setup();
  run(["on", "--harness", "claude"], { env: { ...env, CLAUDE_CODE_SESSION_ID: "a" } });
  hook("stop", "claude", { session_id: "a", last_assistant_message: "x" }, env);
  hook("prompt", "claude", { session_id: "a", prompt: "revisa con codex" }, env);
  assert.equal(hook("prompt", "codex", { session_id: "nested", prompt: "review" }, env), "");
  assert.equal(hook("stop", "codex", { session_id: "nested", last_assistant_message: "x" }, env), "{}");
  assert.equal(state(env).owner, "claude:a");
  assert.ok(state(env).pending, "owner's pending audio survives");
});

test("Antigravity injects a system message once per turn and reads the reply from the transcript", () => {
  const { root, env } = setup();
  const agyEnv = { ...env, ANTIGRAVITY_CONVERSATION_ID: "g" };
  run(["on", "--harness", "antigravity"], { env: agyEnv });
  hook("stop", "antigravity", { conversationId: "g" }, env);
  const out = JSON.parse(hook("prompt", "antigravity", { conversationId: "g", invocationNum: 0 }, env));
  const path = pathFrom(out.inject_steps[0].system_message.system_message);
  assert.equal(hook("prompt", "antigravity", { conversationId: "g", invocationNum: 1 }, env), "{}");
  const transcript = join(root, "transcript.jsonl");
  writeFileSync(
    transcript,
    [
      JSON.stringify({ source: "USER_EXPLICIT", type: "USER_INPUT", content: "hola" }),
      JSON.stringify({ source: "MODEL", type: "PLANNER_RESPONSE", content: `Hola.\n![Audio](${path})` }),
    ].join("\n"),
  );
  assert.equal(hook("stop", "antigravity", { conversationId: "g", transcriptPath: transcript }, env), '{"decision":"stop"}');
  assert.ok(waitFor(path));
  assert.equal(readFileSync(path, "utf8").trim(), "resumen de antigravity");
});

test("a reply without its audio line renders nothing", () => {
  const { env } = setup();
  const path = pathFrom(run(["on", "--harness", "claude"], { env: { ...env, CLAUDE_CODE_SESSION_ID: "a" } }));
  hook("stop", "claude", { session_id: "a", last_assistant_message: "Olvidé la línea." }, env);
  assert.equal(waitFor(path, 1500), false);
  assert.equal(state(env).pending, null);
});

test("a failed summarizer falls back to the reply's plain text", () => {
  const { env } = setup();
  const failEnv = { ...env, FAKE_FAIL: "1" };
  const path = pathFrom(run(["on", "--harness", "claude"], { env: failEnv }));
  hook("stop", "claude", { session_id: "a", last_assistant_message: `## Resultado\nTodo **bien**.\n\`\`\`js\ncode()\n\`\`\`\n![Audio](${path})` }, failEnv);
  assert.ok(waitFor(path));
  assert.equal(readFileSync(path, "utf8").trim(), "Resultado Todo bien.");
});

test("inside a sandbox, on goes through the spool and the Stop hook applies it", () => {
  const { root, env } = setup();
  const spoolEnv = { ...env, VOZ_SPOOL: join(root, "spool") };
  mkdirSync(spoolEnv.VOZ_HOME, { recursive: true });
  chmodSync(spoolEnv.VOZ_HOME, 0o555);
  const onOut = run(["on", "--harness", "codex"], { env: { ...spoolEnv, CODEX_THREAD_ID: "c" } });
  chmodSync(spoolEnv.VOZ_HOME, 0o755);
  assert.match(onOut, /sandbox blocked the state folder/);
  assert.equal(existsSync(join(spoolEnv.VOZ_HOME, "conversations")), false);
  const path = pathFrom(onOut);
  hook("stop", "codex", { session_id: "c", last_assistant_message: `ok\n![Audio](${path})` }, spoolEnv);
  assert.ok(waitFor(path));
  assert.equal(state(spoolEnv).owner, "codex:c");
  assert.deepEqual(readdirSync(spoolEnv.VOZ_SPOOL), []);
});

test("off stops the prompt hook from asking for audio", () => {
  const { env } = setup();
  run(["on", "--harness", "claude"], { env });
  run(["off", "--harness", "claude"], { env });
  assert.equal(hook("prompt", "claude", { session_id: "a", prompt: "hola" }, env), "");
});

test("agents launched by the summarizer never run the hooks", () => {
  const { env } = setup();
  run(["on", "--harness", "claude"], { env });
  assert.equal(hook("prompt", "claude", { session_id: "a", prompt: "hola" }, { ...env, VOZ_INNER: "1" }), "");
});

test("clean deletes audio by age, by conversation, and drops empty idle folders", () => {
  const { env } = setup();
  const conversations = join(env.VOZ_HOME, "conversations");
  for (const key of ["t3-old", "t3-new"]) mkdirSync(join(conversations, key), { recursive: true });
  const oldFile = join(conversations, "t3-old", "a.m4a");
  const newFile = join(conversations, "t3-new", "b.m4a");
  writeFileSync(oldFile, "x");
  writeFileSync(newFile, "y");
  const longAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  utimesSync(oldFile, longAgo, longAgo);

  assert.match(run(["clean"], { env }), /Deleted 1 audio files/);
  assert.equal(existsSync(oldFile), false);
  assert.equal(existsSync(join(conversations, "t3-old")), false);
  assert.equal(existsSync(newFile), true);

  assert.match(run(["clean", "--conversation", "t3-new"], { env }), /Deleted 1 audio files/);
  assert.deepEqual(readdirSync(conversations), []);
});

test("status and list describe the stored audio", () => {
  const { env } = setup();
  const path = pathFrom(run(["on", "--harness", "claude"], { env }));
  hook("stop", "claude", { session_id: "a", last_assistant_message: `ok\n![Audio](${path})` }, env);
  assert.ok(waitFor(path));
  assert.match(run(["status", "--harness", "claude"], { env }), /Voice mode is on .* 1 audio files/);
  assert.match(run(["list"], { env }), /^on +t3-thread-1 +1 files/m);
});
