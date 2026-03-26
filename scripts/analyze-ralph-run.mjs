import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.log(`Usage: node scripts/analyze-ralph-run.mjs [project-dir] [--run <run-id>] [--json]`);
}

export function exists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

export function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDuration(totalSeconds) {
  const value = Number(totalSeconds) || 0;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function parseArgs(argv) {
  let projectDir = process.cwd();
  let runId = "";
  let json = false;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--run") {
      runId = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    projectDir = path.resolve(arg);
  }
  return { projectDir, runId, json };
}

export function parseSummaryMarkdown(filePath) {
  const text = fs.readFileSync(filePath, "utf-8");
  const getField = (label) => {
    const match = text.match(new RegExp(`^- ${label}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : "";
  };
  const storyField = getField("Story");
  const storyMatch = storyField.match(/^([^:]+):\s*(.+)$/);
  return {
    runId: getField("Run ID"),
    iteration: Number(getField("Iteration") || "0"),
    mode: getField("Mode"),
    storyId: storyMatch ? storyMatch[1].trim() : "",
    storyTitle: storyMatch ? storyMatch[2].trim() : storyField,
    started: getField("Started"),
    ended: getField("Ended"),
    durationSeconds: Number((getField("Duration").match(/^(\d+)/) || [])[1] || "0"),
    tokens: Number(String(getField("Tokens") || "").replace(/,/g, "")) || null,
    status: getField("Status"),
    logFile: getField("Log"),
  };
}

export function findLatestBuildRun(runsDir) {
  const summaries = fs.readdirSync(runsDir)
    .filter((name) => /^run-.+-iter-\d+\.md$/.test(name))
    .map((name) => path.join(runsDir, name))
    .map((filePath) => ({ filePath, data: parseSummaryMarkdown(filePath) }))
    .filter(({ data }) => data.runId);
  const latest = new Map();
  for (const item of summaries) {
    const current = latest.get(item.data.runId);
    if (!current || new Date(item.data.ended || 0) > new Date(current.data.ended || 0)) {
      latest.set(item.data.runId, item);
    }
  }
  const values = Array.from(latest.values());
  values.sort((a, b) => new Date(b.data.ended || 0) - new Date(a.data.ended || 0));
  return values[0]?.data.runId || "";
}

export function loadRunIterations(runsDir, runId) {
  return fs.readdirSync(runsDir)
    .filter((name) => name.startsWith(`run-${runId}-iter-`) && name.endsWith(".md"))
    .map((name) => {
      const filePath = path.join(runsDir, name);
      const data = parseSummaryMarkdown(filePath);
      const metricsPath = filePath.replace(/\.md$/i, ".metrics.json");
      const metrics = exists(metricsPath) ? JSON.parse(fs.readFileSync(metricsPath, "utf-8")) : null;
      return { ...data, metricsPath: exists(metricsPath) ? metricsPath : "", metrics };
    })
    .sort((a, b) => a.iteration - b.iteration);
}

export function findNearestPrdLog(runsDir, runId) {
  const buildPrefix = runId.split("-").slice(0, 2).join("-");
  const candidates = fs.readdirSync(runsDir)
    .filter((name) => name.startsWith("prd-") && name.endsWith(".log"))
    .filter((name) => name.slice(4, 17) <= buildPrefix)
    .sort();
  return candidates.length ? path.join(runsDir, candidates[candidates.length - 1]) : "";
}

export function extractTokensUsed(logFile) {
  if (!logFile || !exists(logFile)) return null;
  const text = fs.readFileSync(logFile, "utf-8");
  const matches = Array.from(text.matchAll(/tokens used\s*\r?\n([\d,]+)/gi));
  if (!matches.length) return null;
  return Number(String(matches[matches.length - 1][1] || "").replace(/,/g, "")) || null;
}

export function extractSessionId(logFile) {
  if (!logFile || !exists(logFile)) return "";
  const text = fs.readFileSync(logFile, "utf-8");
  const match = text.match(/^session id:\s*([^\r\n]+)$/mi);
  return match ? String(match[1] || "").trim() : "";
}

export function findCodexSessionFile(sessionId) {
  if (!sessionId) return "";
  const sessionsRoot = path.join(process.env.USERPROFILE || process.env.HOME || "", ".codex", "sessions");
  if (!exists(sessionsRoot)) return "";
  const queue = [sessionsRoot];
  while (queue.length) {
    const current = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(`${sessionId}.jsonl`)) {
        return fullPath;
      }
    }
  }
  return "";
}

export function extractTokenStats(logFile) {
  const sessionId = extractSessionId(logFile);
  const sessionFile = findCodexSessionFile(sessionId);
  if (sessionFile && exists(sessionFile)) {
    const lines = fs.readFileSync(sessionFile, "utf-8").split(/\r?\n/);
    let latest = null;
    for (const line of lines) {
      if (!line.includes("\"type\":\"token_count\"") || !line.includes("\"total_token_usage\"")) continue;
      try {
        const data = JSON.parse(line);
        const usage = data?.payload?.info?.total_token_usage;
        if (!usage) continue;
        const inputTokens = Number(usage.input_tokens || 0);
        const cachedInputTokens = Number(usage.cached_input_tokens || 0);
        const outputTokens = Number(usage.output_tokens || 0);
        const reasoningOutputTokens = Number(usage.reasoning_output_tokens || 0);
        const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
        const priceishTokens = uncachedInputTokens + outputTokens + reasoningOutputTokens;
        latest = {
          inputTokens,
          cachedInputTokens,
          uncachedInputTokens,
          outputTokens,
          reasoningOutputTokens,
          priceishTokens,
          totalTokens: priceishTokens,
        };
      } catch {}
    }
    if (latest) return latest;
  }
  const totalTokens = extractTokensUsed(logFile);
  return totalTokens == null ? null : { priceishTokens: totalTokens, totalTokens };
}

export function summarizeRun(projectDir, runId) {
  const runsDir = path.join(projectDir, ".ralph", "runs");
  if (!exists(runsDir)) {
    throw new Error(`Runs directory not found: ${runsDir}`);
  }
  const resolvedRunId = runId || findLatestBuildRun(runsDir);
  if (!resolvedRunId) {
    throw new Error("No Ralph build runs found.");
  }
  const iterations = loadRunIterations(runsDir, resolvedRunId);
  if (!iterations.length) {
    throw new Error(`No iterations found for run ${resolvedRunId}.`);
  }
  const prdLog = findNearestPrdLog(runsDir, resolvedRunId);
  const prdTokenStats = extractTokenStats(prdLog);
  const prdTokens = prdTokenStats?.priceishTokens ?? prdTokenStats?.totalTokens ?? extractTokensUsed(prdLog);
  const buildTokenStats = iterations.reduce((acc, item) => {
    const stats = item.metrics?.tokenStats || extractTokenStats(item.logFile) || {};
    const priceishTokens = Number(stats.priceishTokens || stats.totalTokens || item.tokens || 0);
    acc.priceishTokens += priceishTokens;
    acc.totalTokens += Number(stats.totalTokens || priceishTokens);
    acc.inputTokens += Number(stats.inputTokens || 0);
    acc.cachedInputTokens += Number(stats.cachedInputTokens || 0);
    acc.uncachedInputTokens += Number(stats.uncachedInputTokens || 0);
    acc.outputTokens += Number(stats.outputTokens || 0);
    acc.reasoningOutputTokens += Number(stats.reasoningOutputTokens || 0);
    return acc;
  }, {
    priceishTokens: 0,
    totalTokens: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    uncachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
  });
  const buildTokens = buildTokenStats.priceishTokens || buildTokenStats.totalTokens;
  const buildSeconds = iterations.reduce((sum, item) => sum + item.durationSeconds, 0);
  const withMetrics = iterations.filter((item) => item.metrics);
  const metricTotals = withMetrics.reduce((acc, item) => {
    const timing = item.metrics?.timing || {};
    acc.agentRunMs += Number(timing.agentRunMs || 0);
    acc.storySelectionMs += Number(timing.storySelectionMs || 0);
    acc.progressSnapshotMs += Number(timing.progressSnapshotMs || 0);
    acc.promptRenderMs += Number(timing.promptRenderMs || 0);
    acc.postprocessMs += Number(timing.postprocessMs || 0);
    acc.promptBytes += Number(item.metrics?.prompt?.bytes || 0);
    acc.progressBytes += Number(item.metrics?.progressSnapshot?.bytes || 0);
    return acc;
  }, {
    agentRunMs: 0,
    storySelectionMs: 0,
    progressSnapshotMs: 0,
    promptRenderMs: 0,
    postprocessMs: 0,
    promptBytes: 0,
    progressBytes: 0,
  });

  return {
    projectDir,
    runId: resolvedRunId,
    prdLog,
    prdTokenStats,
    prdTokens,
    build: {
      iterations: iterations.length,
      totalSeconds: buildSeconds,
      priceishTokens: buildTokens,
      totalTokens: buildTokens,
      tokenStats: buildTokenStats,
      started: iterations[0].started,
      ended: iterations[iterations.length - 1].ended,
    },
    totals: {
      priceishTokens: buildTokens + (prdTokens || 0),
      totalTokens: buildTokens + (prdTokens || 0),
      totalSeconds: buildSeconds,
    },
    metrics: {
      sampledIterations: withMetrics.length,
      ...metricTotals,
    },
    iterations,
  };
}

export function printSummary(summary) {
  console.log(`Project: ${summary.projectDir}`);
  console.log(`Run ID: ${summary.runId}`);
  console.log(`Build: ${summary.build.started} -> ${summary.build.ended}`);
  console.log(`Iterations: ${summary.build.iterations}`);
  console.log(`Build Time: ${formatDuration(summary.build.totalSeconds)}`);
  console.log(`Build Price-ish Tokens: ${formatCount(summary.build.priceishTokens)}`);
  if (summary.build.tokenStats.inputTokens) {
    console.log(`Build Token Detail: uncached input ${formatCount(summary.build.tokenStats.uncachedInputTokens)} | cached input ${formatCount(summary.build.tokenStats.cachedInputTokens)} | output ${formatCount(summary.build.tokenStats.outputTokens)} | reasoning ${formatCount(summary.build.tokenStats.reasoningOutputTokens)} | raw input ${formatCount(summary.build.tokenStats.inputTokens)}`);
  }
  if (summary.prdTokens != null) {
    console.log(`PRD Price-ish Tokens: ${formatCount(summary.prdTokens)}`);
    if (summary.prdTokenStats?.inputTokens) {
      console.log(`PRD Token Detail: uncached input ${formatCount(summary.prdTokenStats.uncachedInputTokens)} | cached input ${formatCount(summary.prdTokenStats.cachedInputTokens)} | output ${formatCount(summary.prdTokenStats.outputTokens)} | reasoning ${formatCount(summary.prdTokenStats.reasoningOutputTokens)} | raw input ${formatCount(summary.prdTokenStats.inputTokens)}`);
    }
    console.log(`End-to-end Price-ish Tokens: ${formatCount(summary.totals.priceishTokens)}`);
  }
  if (summary.metrics.sampledIterations > 0) {
    console.log(`Measured Prompt Bytes: ${formatCount(summary.metrics.promptBytes)}`);
    console.log(`Measured Progress Snapshot Bytes: ${formatCount(summary.metrics.progressBytes)}`);
    console.log(`Measured Agent Time: ${formatDuration(Math.round(summary.metrics.agentRunMs / 1000))}`);
  }
  console.log("");
  console.log("Per iteration:");
  for (const item of summary.iterations) {
    const tokenStats = item.metrics?.tokenStats || extractTokenStats(item.logFile) || null;
    const priceishTokens = tokenStats?.priceishTokens || tokenStats?.totalTokens || item.tokens;
    const tokenText = priceishTokens == null ? "unknown" : formatCount(priceishTokens);
    const detail = tokenStats?.inputTokens
      ? ` | uncached input ${formatCount(tokenStats.uncachedInputTokens)} | cached input ${formatCount(tokenStats.cachedInputTokens)} | output ${formatCount(tokenStats.outputTokens)} | reasoning ${formatCount(tokenStats.reasoningOutputTokens)}`
      : "";
    console.log(`- ${item.iteration}. ${item.storyId} | ${formatDuration(item.durationSeconds)} | ${tokenText} price-ish tokens | ${item.status}${detail}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const { projectDir, runId, json } = parseArgs(process.argv);
    const summary = summarizeRun(projectDir, runId);
    if (json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      printSummary(summary);
    }
  } catch (error) {
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
  }
}
