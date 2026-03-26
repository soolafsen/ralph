import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { summarizeRun, formatCount, formatDuration } from "./analyze-ralph-run.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const definitionsPath = path.join(repoRoot, "benchmarks", "definitions.json");
const historyDir = path.join(repoRoot, "benchmarks", "history");
const latestDir = path.join(repoRoot, "benchmarks", "latest");

function usage() {
  console.log("Usage: node scripts/record-ralph-benchmark.mjs --benchmark <id> [project-dir] [--run <run-id>] [--notes <text>]");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function parseArgs(argv) {
  let projectDir = process.cwd();
  let runId = "";
  let benchmarkId = "";
  let notes = "";
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
    if (arg === "--benchmark") {
      benchmarkId = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--notes") {
      notes = argv[i + 1] || "";
      i += 1;
      continue;
    }
    projectDir = path.resolve(arg);
  }
  if (!benchmarkId) {
    usage();
    throw new Error("--benchmark is required");
  }
  return { projectDir, runId, benchmarkId, notes };
}

function loadDefinitions() {
  const data = readJson(definitionsPath);
  return Array.isArray(data.benchmarks) ? data.benchmarks : [];
}

function getBenchmarkDefinition(benchmarkId) {
  const definition = loadDefinitions().find((item) => item.id === benchmarkId);
  if (!definition) {
    throw new Error(`Unknown benchmark id: ${benchmarkId}`);
  }
  return definition;
}

function gitInfo() {
  const branch = spawnSync("git", ["-C", repoRoot, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8" });
  const commit = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf-8" });
  return {
    branch: branch.status === 0 ? String(branch.stdout || "").trim() : "",
    commit: commit.status === 0 ? String(commit.stdout || "").trim() : "",
  };
}

function extractField(logFile, label) {
  if (!logFile || !fs.existsSync(logFile)) return "";
  const text = fs.readFileSync(logFile, "utf-8");
  const match = text.match(new RegExp(`^${label}:\\s*([^\\r\\n]+)$`, "mi"));
  return match ? String(match[1] || "").trim() : "";
}

function readHistory(benchmarkId) {
  const filePath = path.join(historyDir, `${benchmarkId}.jsonl`);
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf-8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function formatDelta(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return "n/a";
  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatCount(delta)}`;
}

function buildRecord(benchmarkId, definition, summary, notes) {
  const git = gitInfo();
  const firstLog = summary.iterations[0]?.logFile || "";
  return {
    schemaVersion: 1,
    benchmarkId,
    benchmarkName: definition.name,
    skill: definition.skill,
    recordedAt: new Date().toISOString(),
    projectName: path.basename(summary.projectDir),
    runId: summary.runId,
    backend: summary.iterations[0]?.metrics?.backend || summary.iterations[0]?.backend || "unknown",
    model: extractField(firstLog, "model") || "unknown",
    reasoningEffort: extractField(firstLog, "reasoning effort") || "unknown",
    ralphBranch: git.branch,
    ralphCommit: git.commit,
    prdTokens: summary.prdTokens ?? null,
    buildTokens: summary.build.totalTokens,
    totalTokens: summary.totals.totalTokens,
    buildSeconds: summary.build.totalSeconds,
    buildIterations: summary.build.iterations,
    buildStarted: summary.build.started,
    buildEnded: summary.build.ended,
    status: summary.iterations.every((item) => item.status === "success") ? "success" : "mixed",
    notes: notes || "",
    stories: summary.iterations.map((item) => ({
      iteration: item.iteration,
      storyId: item.storyId,
      storyTitle: item.storyTitle,
      status: item.status,
      durationSeconds: item.durationSeconds,
      tokens: item.tokens,
    })),
  };
}

function appendHistory(record) {
  ensureDir(historyDir);
  const filePath = path.join(historyDir, `${record.benchmarkId}.jsonl`);
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`);
  return filePath;
}

function writeLatestMarkdown(record, previous) {
  ensureDir(latestDir);
  const lines = [
    `# ${record.benchmarkName}`,
    "",
    `- Benchmark ID: ${record.benchmarkId}`,
    `- Skill: ${record.skill}`,
    `- Recorded: ${record.recordedAt}`,
    `- Ralph Branch: ${record.ralphBranch || "unknown"}`,
    `- Ralph Commit: ${record.ralphCommit || "unknown"}`,
    `- Backend: ${record.backend}`,
    `- Model: ${record.model}`,
    `- Reasoning Effort: ${record.reasoningEffort}`,
    `- Build Time: ${formatDuration(record.buildSeconds)}`,
    `- PRD Tokens: ${record.prdTokens == null ? "unknown" : formatCount(record.prdTokens)}`,
    `- Build Tokens: ${formatCount(record.buildTokens)}`,
    `- Total Tokens: ${formatCount(record.totalTokens)}`,
    "",
  ];
  if (previous) {
    lines.push(
      "## Delta Vs Previous",
      "",
      `- Build Time: ${formatDelta(record.buildSeconds, previous.buildSeconds)}s`,
      `- Build Tokens: ${formatDelta(record.buildTokens, previous.buildTokens)}`,
      `- Total Tokens: ${formatDelta(record.totalTokens, previous.totalTokens)}`,
      "",
    );
  }
  lines.push("## Stories", "");
  for (const item of record.stories) {
    lines.push(`- ${item.iteration}. ${item.storyId} | ${formatDuration(item.durationSeconds)} | ${formatCount(item.tokens || 0)} tokens | ${item.status}`);
  }
  if (record.notes) {
    lines.push("", "## Notes", "", `- ${record.notes}`);
  }
  const filePath = path.join(latestDir, `${record.benchmarkId}.md`);
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
  return filePath;
}

function printSummary(record, previous, historyFile, latestFile) {
  console.log(`Benchmark: ${record.benchmarkId} (${record.benchmarkName})`);
  console.log(`Run ID: ${record.runId}`);
  console.log(`Build Time: ${formatDuration(record.buildSeconds)}`);
  console.log(`Build Tokens: ${formatCount(record.buildTokens)}`);
  console.log(`Total Tokens: ${formatCount(record.totalTokens)}`);
  if (previous) {
    console.log(`Vs Previous Build Time: ${formatDelta(record.buildSeconds, previous.buildSeconds)}s`);
    console.log(`Vs Previous Build Tokens: ${formatDelta(record.buildTokens, previous.buildTokens)}`);
    console.log(`Vs Previous Total Tokens: ${formatDelta(record.totalTokens, previous.totalTokens)}`);
  }
  console.log(`History: ${historyFile}`);
  console.log(`Latest: ${latestFile}`);
}

try {
  const { projectDir, runId, benchmarkId, notes } = parseArgs(process.argv);
  const definition = getBenchmarkDefinition(benchmarkId);
  const summary = summarizeRun(projectDir, runId);
  const record = buildRecord(benchmarkId, definition, summary, notes);
  const history = readHistory(benchmarkId);
  const previous = history.length ? history[history.length - 1] : null;
  const historyFile = appendHistory(record);
  const latestFile = writeLatestMarkdown(record, previous);
  printSummary(record, previous, historyFile, latestFile);
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
