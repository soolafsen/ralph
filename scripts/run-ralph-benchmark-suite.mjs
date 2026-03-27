import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const definitionsPath = path.join(repoRoot, "benchmarks", "definitions.json");
const workspaceRoot = process.env.RALPH_BENCHMARK_WORKSPACE_ROOT
  ? path.resolve(process.env.RALPH_BENCHMARK_WORKSPACE_ROOT)
  : path.join(repoRoot, "benchmarks", "workspaces");
const binPath = path.join(repoRoot, "bin", "ralph");
const recordScript = path.join(repoRoot, "scripts", "record-ralph-benchmark.mjs");
const compareSuiteScript = path.join(repoRoot, "scripts", "compare-ralph-suite.mjs");

function usage() {
  console.log("Usage: node scripts/run-ralph-benchmark-suite.mjs --suite <id> [--keep-workspaces]");
}

function parseArgs(argv) {
  let suiteId = "";
  let keepWorkspaces = false;
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
    if (arg === "--keep-workspaces") {
      keepWorkspaces = true;
    }
  }
  if (!suiteId) {
    usage();
    throw new Error("--suite is required");
  }
  return { suiteId, keepWorkspaces };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    encoding: "utf-8",
    ...options,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result;
}

function runBestEffort(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: "inherit",
    encoding: "utf-8",
    ...options,
  });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copySkill(skillName, targetRoot) {
  const source = path.join(repoRoot, "skills", skillName);
  const target = path.join(targetRoot, skillName);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing bundled skill: ${skillName}`);
  }
  fs.cpSync(source, target, { recursive: true, force: true });
}

function prepareWorkspace(workspaceDir, benchmark) {
  fs.rmSync(workspaceDir, { recursive: true, force: true });
  ensureDir(workspaceDir);
  ensureDir(path.join(workspaceDir, ".codex", "skills"));
  copySkill("prd", path.join(workspaceDir, ".codex", "skills"));
  copySkill(benchmark.skill, path.join(workspaceDir, ".codex", "skills"));
  run("git", ["init"], { cwd: workspaceDir });
  runBestEffort("git", ["config", "user.name", "Ralph Benchmark"], { cwd: workspaceDir });
  runBestEffort("git", ["config", "user.email", "ralph-benchmark@example.invalid"], { cwd: workspaceDir });
}

function resolvePrdPath(workspaceDir, benchmark) {
  const tasksDir = path.join(workspaceDir, ".agents", "tasks");
  const expected = path.join(tasksDir, benchmark.expectedPrdFilename);
  if (fs.existsSync(expected)) return expected;
  if (!fs.existsSync(tasksDir)) {
    throw new Error(`PRD output directory not found: ${tasksDir}`);
  }
  const candidates = fs.readdirSync(tasksDir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .map((name) => path.join(tasksDir, name));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    throw new Error(`No PRD JSON files generated for ${benchmark.id}`);
  }
  throw new Error(`Unable to resolve PRD path for ${benchmark.id}`);
}

function runBenchmark(workspaceDir, benchmark) {
  const env = {
    ...process.env,
    RALPH_SKIP_UPDATE_CHECK: "1",
  };
  console.log(`\n=== ${benchmark.id}: generate PRD ===`);
  run(process.execPath, [binPath, "prd", `Use $${benchmark.skill}`, "--quiet"], {
    cwd: workspaceDir,
    env,
  });
  const prdPath = resolvePrdPath(workspaceDir, benchmark);
  console.log(`\n=== ${benchmark.id}: build ===`);
  run(process.execPath, [binPath, "build", "--prd", prdPath, "--no-commit", "--quiet"], {
    cwd: workspaceDir,
    env,
  });
  console.log(`\n=== ${benchmark.id}: record ===`);
  run(process.execPath, [recordScript, "--benchmark", benchmark.id, workspaceDir], {
    cwd: repoRoot,
    env,
  });
}

function summarizeSuite(definitions, suiteId) {
  const suite = (definitions.suites || []).find((item) => item.id === suiteId);
  if (!suite) throw new Error(`Unknown suite id: ${suiteId}`);
  const benchmarks = (suite.benchmarkIds || []).map((id) => {
    const benchmark = (definitions.benchmarks || []).find((item) => item.id === id);
    if (!benchmark) throw new Error(`Unknown benchmark id in suite ${suiteId}: ${id}`);
    return benchmark;
  });
  return { suite, benchmarks };
}

try {
  const { suiteId, keepWorkspaces } = parseArgs(process.argv);
  const definitions = readJson(definitionsPath);
  const { suite, benchmarks } = summarizeSuite(definitions, suiteId);
  ensureDir(workspaceRoot);
  console.log(`Running suite ${suite.id}: ${suite.name}`);
  if (suite.targetMaxMinutes) {
    console.log(`Target max minutes: ${suite.targetMaxMinutes}`);
  }
  for (const benchmark of benchmarks) {
    const workspaceDir = path.join(workspaceRoot, benchmark.id);
    prepareWorkspace(workspaceDir, benchmark);
    runBenchmark(workspaceDir, benchmark);
    if (!keepWorkspaces) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  }
  console.log(`\n=== suite summary: ${suite.id} ===`);
  run(process.execPath, [compareSuiteScript, "--suite", suite.id], {
    cwd: repoRoot,
    env: {
      ...process.env,
      RALPH_SKIP_UPDATE_CHECK: "1",
    },
  });
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
