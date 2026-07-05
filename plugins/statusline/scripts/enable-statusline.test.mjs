import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = join(__dirname, "enable-statusline.mjs");

function runEnable(home) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [script], { env: { ...process.env, HOME: home } }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\nstdout: ${stdout}\nstderr: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

test("enables statusline using a stable user-level renderer path", async () => {
  const home = await mkdtemp(join(tmpdir(), "statusline-home-"));

  const stdout = await runEnable(home);
  const settings = JSON.parse(await readFile(join(home, ".claude", "settings.json"), "utf8"));
  const renderer = join(home, ".claude", "statusline-behagoras.mjs");
  const rendererStat = await stat(renderer);

  assert.equal(settings.statusLine.type, "command");
  assert.equal(settings.statusLine.command, `node '${renderer}'`);
  assert.equal(settings.statusLine.padding, 0);
  assert.equal(rendererStat.mode & 0o111, 0o111);
  assert.match(stdout, /Installed renderer:/);
});
