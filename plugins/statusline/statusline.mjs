#!/usr/bin/env node

const ANSI = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m"
};

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function color(text, ansi) {
  return `${ansi}${text}${ANSI.reset}`;
}

function visibleWidth(text) {
  return text.replace(ANSI_PATTERN, "").length;
}

function numberOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(numberOr(value, 0))));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(numberOr(ms, 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function formatTokens(n) {
  const value = numberOr(n, 0);
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return `${value}`;
}

function contextColor(percent) {
  if (percent >= 90) return ANSI.red;
  if (percent >= 70) return ANSI.yellow;
  return ANSI.green;
}

function progressBar(percent) {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

function rateLimitSegment(label, window) {
  if (!window || window.used_percentage == null) return null;

  const percent = clampPercent(window.used_percentage);
  const segment = `${label}: ${percent}%`;
  return percent >= 80 ? color(segment, ANSI.red) : segment;
}

function columnsFromEnv() {
  const columns = Number.parseInt(process.env.COLUMNS ?? "", 10);
  return Number.isFinite(columns) && columns > 0 ? columns : Infinity;
}

function renderStatus(data) {
  const model = data?.model?.display_name || "Claude";
  const effort = data?.effort?.level;
  const contextPercent = clampPercent(data?.context_window?.used_percentage);
  const usedTokens =
    numberOr(data?.context_window?.total_input_tokens) +
    numberOr(data?.context_window?.total_output_tokens);
  const windowSize = numberOr(data?.context_window?.context_window_size);
  const cost = numberOr(data?.cost?.total_cost_usd, 0).toFixed(2);
  const duration = formatDuration(data?.cost?.total_duration_ms);

  const modelLabel = effort ? `${model} · ${effort}` : model;
  const modelSegment = color(`[${modelLabel}]`, ANSI.cyan);
  const contextDetail = windowSize
    ? ` ${contextPercent}% (${formatTokens(usedTokens)}/${formatTokens(windowSize)})`
    : ` ${contextPercent}%`;
  const contextSegment = `${color(progressBar(contextPercent), contextColor(contextPercent))}${contextDetail}`;
  const costDurationSegment = `${color(`$${cost}`, ANSI.yellow)} | ${duration}`;

  const rateSegments = [
    rateLimitSegment("5h", data?.rate_limits?.five_hour),
    rateLimitSegment("7d", data?.rate_limits?.seven_day)
  ].filter(Boolean);
  const rateSegment = rateSegments.join(" ");

  const lineSegments = [modelSegment, contextSegment, costDurationSegment];
  if (rateSegment) lineSegments.push(rateSegment);

  const oneLine = lineSegments.join(" | ");
  if (visibleWidth(oneLine) <= columnsFromEnv()) {
    return oneLine;
  }

  const secondLine = [costDurationSegment, rateSegment].filter(Boolean).join(" | ");
  return `${modelSegment} | ${contextSegment}\n${secondLine}`;
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input.trim();
}

try {
  const input = await readStdin();
  if (!input) {
    console.log(color("[Claude]", ANSI.cyan));
    process.exit(0);
  }

  const data = JSON.parse(input);
  console.log(renderStatus(data));
} catch {
  console.log(color("[Claude]", ANSI.cyan));
}
