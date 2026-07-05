import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = join(__dirname, "statusline.mjs");
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(text) {
  return text.replace(ANSI_PATTERN, "");
}

function runStatusline(input, env = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [script],
      { env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\nstdout: ${stdout}\nstderr: ${stderr}`));
          return;
        }
        resolve(stdout.trimEnd());
      }
    );

    child.stdin.end(input);
  });
}

test("renders the full single-line status", async () => {
  const payload = {
    model: { display_name: "Opus" },
    context_window: { used_percentage: 34 },
    cost: { total_cost_usd: 1.23, total_duration_ms: 2712000 },
    rate_limits: {
      five_hour: { used_percentage: 23 },
      seven_day: { used_percentage: 41 }
    }
  };

  const output = stripAnsi(await runStatusline(JSON.stringify(payload), { COLUMNS: "120" }));

  assert.equal(output, "[Opus] | ███░░░░░░░ 34% | $1.23 | 45m 12s | 5h: 23% 7d: 41%");
});

test("falls back to zero context when used_percentage is null", async () => {
  const output = stripAnsi(
    await runStatusline(
      JSON.stringify({
        model: { display_name: "Sonnet" },
        context_window: { used_percentage: null },
        cost: { total_cost_usd: 0, total_duration_ms: 0 }
      }),
      { COLUMNS: "120" }
    )
  );

  assert.match(output, /\[Sonnet\] \| ░░░░░░░░░░ 0% \| \$0\.00 \| 0s/);
});

test("omits rate limits when absent", async () => {
  const output = stripAnsi(
    await runStatusline(
      JSON.stringify({
        model: { display_name: "Haiku" },
        context_window: { used_percentage: 91 },
        cost: { total_cost_usd: 2, total_duration_ms: 65000 }
      }),
      { COLUMNS: "120" }
    )
  );

  assert.equal(output, "[Haiku] | █████████░ 91% | $2.00 | 1m 5s");
});

test("uses two lines when COLUMNS is narrow", async () => {
  const payload = {
    model: { display_name: "Opus" },
    context_window: { used_percentage: 34 },
    cost: { total_cost_usd: 1.23, total_duration_ms: 2712000 },
    rate_limits: {
      five_hour: { used_percentage: 23 },
      seven_day: { used_percentage: 41 }
    }
  };

  const output = stripAnsi(await runStatusline(JSON.stringify(payload), { COLUMNS: "30" }));

  assert.equal(output, "[Opus] | ███░░░░░░░ 34%\n$1.23 | 45m 12s | 5h: 23% 7d: 41%");
});

test("prints a minimal fallback for malformed or empty stdin", async () => {
  assert.equal(stripAnsi(await runStatusline("", { COLUMNS: "120" })), "[Claude]");
  assert.equal(stripAnsi(await runStatusline("{bad json", { COLUMNS: "120" })), "[Claude]");
});
