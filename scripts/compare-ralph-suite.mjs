import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatCount, formatDuration } from "./analyze-ralph-run.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const definitionsPath = path.join(repoRoot, "benchmarks", "definitions.json");
const historyDir = path.join(repoRoot, "benchmarks", "history");
const latestDir = path.join(repoRoot, "benchmarks", "latest");

function usage() {
  console.log("Usage: node scripts/compare-ralph-suite.mjs --suite <id> [--json]");
}

function parseArgs(argv) {
  let suiteId = "";
  let json = false;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--suite") {
      suiteId = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--json") {
      json = true;
    }
  }
  if (!suiteId) {
    usage();
    throw new Error("--suite is required");
  }
  return { suiteId, json };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadDefinitions() {
  return readJson(definitionsPath);
}

function readHistory(benchmarkId) {
  const filePath = path.join(historyDir, `${benchmarkId}.jsonl`);
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf-8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function latestTwo(history) {
  if (!history.length) return { current: null, previous: null };
  const current = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;
  return { current, previous };
}

function summarizeSuite(definitions, suiteId) {
  const suite = (definitions.suites || []).find((item) => item.id === suiteId);
  if (!suite) throw new Error(`Unknown suite id: ${suiteId}`);
  const benchmarks = [];
  for (const benchmarkId of suite.benchmarkIds || []) {
    const definition = (definitions.benchmarks || []).find((item) => item.id === benchmarkId);
    if (!definition) continue;
    const history = readHistory(benchmarkId);
    const { current, previous } = latestTwo(history);
    benchmarks.push({ definition, current, previous, historyCount: history.length });
  }
  const currentTotals = benchmarks.reduce((acc, item) => {
    if (!item.current) return acc;
    acc.buildSeconds += Number(item.current.buildSeconds || 0);
    acc.buildPriceishTokens += Number(item.current.buildPriceishTokens || 0);
    acc.totalPriceishTokens += Number(item.current.totalPriceishTokens || 0);
    acc.iterations += Number(item.current.buildIterations || 0);
    return acc;
  }, { buildSeconds: 0, buildPriceishTokens: 0, totalPriceishTokens: 0, iterations: 0 });
  const previousTotals = benchmarks.reduce((acc, item) => {
    if (!item.previous) return acc;
    acc.buildSeconds += Number(item.previous.buildSeconds || 0);
    acc.buildPriceishTokens += Number(item.previous.buildPriceishTokens || 0);
    acc.totalPriceishTokens += Number(item.previous.totalPriceishTokens || 0);
    acc.iterations += Number(item.previous.buildIterations || 0);
    return acc;
  }, { buildSeconds: 0, buildPriceishTokens: 0, totalPriceishTokens: 0, iterations: 0 });
  return {
    suite,
    benchmarks,
    totals: {
      current: currentTotals,
      previous: previousTotals,
    },
  };
}

function delta(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return current - previous;
}

function printSuite(summary) {
  console.log(`Suite: ${summary.suite.id} (${summary.suite.name})`);
  console.log(`Benchmarks: ${summary.benchmarks.map((item) => item.definition.id).join(", ")}`);
  console.log(`Build Time: ${formatDuration(summary.totals.current.buildSeconds)}`);
  console.log(`Build Price-ish Tokens: ${formatCount(summary.totals.current.buildPriceishTokens)}`);
  console.log(`End-to-end Price-ish Tokens: ${formatCount(summary.totals.current.totalPriceishTokens)}`);
  console.log(`Iterations: ${formatCount(summary.totals.current.iterations)}`);
  if (summary.totals.previous.buildSeconds > 0 || summary.totals.previous.buildPriceishTokens > 0 || summary.totals.previous.totalPriceishTokens > 0) {
    console.log(`Vs Previous Build Time: ${delta(summary.totals.current.buildSeconds, summary.totals.previous.buildSeconds) ?? "n/a"}s`);
    console.log(`Vs Previous Build Price-ish Tokens: ${delta(summary.totals.current.buildPriceishTokens, summary.totals.previous.buildPriceishTokens) ?? "n/a"}`);
    console.log(`Vs Previous End-to-end Price-ish Tokens: ${delta(summary.totals.current.totalPriceishTokens, summary.totals.previous.totalPriceishTokens) ?? "n/a"}`);
  }
  console.log("");
  console.log("Per benchmark:");
  for (const item of summary.benchmarks) {
    if (!item.current) {
      console.log(`- ${item.definition.id} | no history yet`);
      continue;
    }
    console.log(`- ${item.definition.id} | ${formatDuration(Number(item.current.buildSeconds || 0))} | build ${formatCount(Number(item.current.buildPriceishTokens || 0))} | total ${formatCount(Number(item.current.totalPriceishTokens || 0))} | runs ${item.historyCount}`);
  }
}

function writeLatestSuiteMarkdown(summary) {
  fs.mkdirSync(latestDir, { recursive: true });
  const lines = [
    `# ${summary.suite.name}`,
    "",
    `- Suite ID: ${summary.suite.id}`,
    `- Benchmarks: ${summary.benchmarks.map((item) => item.definition.id).join(", ")}`,
    `- Build Time: ${formatDuration(summary.totals.current.buildSeconds)}`,
    `- Build Price-ish Tokens: ${formatCount(summary.totals.current.buildPriceishTokens)}`,
    `- End-to-end Price-ish Tokens: ${formatCount(summary.totals.current.totalPriceishTokens)}`,
    `- Iterations: ${formatCount(summary.totals.current.iterations)}`,
    "",
    "## Per Benchmark",
    "",
  ];
  for (const item of summary.benchmarks) {
    if (!item.current) {
      lines.push(`- ${item.definition.id}: no history yet`);
      continue;
    }
    lines.push(`- ${item.definition.id}: ${formatDuration(Number(item.current.buildSeconds || 0))} | build ${formatCount(Number(item.current.buildPriceishTokens || 0))} | total ${formatCount(Number(item.current.totalPriceishTokens || 0))} | runs ${item.historyCount}`);
  }
  const filePath = path.join(latestDir, `suite-${summary.suite.id}.md`);
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
  return filePath;
}

try {
  const { suiteId, json } = parseArgs(process.argv);
  const definitions = loadDefinitions();
  const summary = summarizeSuite(definitions, suiteId);
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSuite(summary);
    const latestFile = writeLatestSuiteMarkdown(summary);
    console.log(`Latest: ${latestFile}`);
  }
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
