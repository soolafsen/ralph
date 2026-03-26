import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatCount, formatDuration } from "./analyze-ralph-run.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const historyDir = path.join(repoRoot, "benchmarks", "history");

function usage() {
  console.log("Usage: node scripts/compare-ralph-benchmark.mjs --benchmark <id>");
}

function parseArgs(argv) {
  let benchmarkId = "";
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--benchmark") {
      benchmarkId = argv[i + 1] || "";
      i += 1;
    }
  }
  if (!benchmarkId) {
    usage();
    throw new Error("--benchmark is required");
  }
  return { benchmarkId };
}

function readHistory(benchmarkId) {
  const filePath = path.join(historyDir, `${benchmarkId}.jsonl`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No benchmark history found for ${benchmarkId}`);
  }
  return fs.readFileSync(filePath, "utf-8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function getBuildPriceishTokens(item) {
  return Number(item.buildPriceishTokens || item.buildTokens || 0);
}

function getTotalPriceishTokens(item) {
  return Number(item.totalPriceishTokens || item.totalTokens || 0);
}

try {
  const { benchmarkId } = parseArgs(process.argv);
  const history = readHistory(benchmarkId);
  console.log(`Benchmark history: ${benchmarkId}`);
  for (const item of history) {
    console.log(`- ${item.recordedAt} | ${item.ralphBranch}@${String(item.ralphCommit || "").slice(0, 7)} | ${item.backend} | ${formatDuration(item.buildSeconds)} | build ${formatCount(getBuildPriceishTokens(item))} price-ish | total ${formatCount(getTotalPriceishTokens(item))} price-ish`);
  }
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
