import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readdirSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function withWindowsHide(options = {}) {
  return process.platform === "win32" ? { ...options, windowsHide: true } : options;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, withWindowsHide({ stdio: "inherit", ...options }));
  if (result.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin", "ralph");

run(process.execPath, [cliPath, "--help"]);

const projectRoot = mkdtempSync(path.join(tmpdir(), "ralph-cli-"));
try {
  const outPath = path.join(projectRoot, "prd.json");
  run(process.execPath, [cliPath, "prd", "Smoke test PRD", "--out", outPath], {
    cwd: projectRoot,
    env: { ...process.env, RALPH_DRY_RUN: "1" },
  });

  if (!existsSync(outPath)) {
    console.error("PRD smoke test failed: output not created.");
    process.exit(1);
  }

  run(process.execPath, [cliPath, "overview", "--prd", outPath], {
    cwd: projectRoot,
    env: { ...process.env },
  });

  const overviewPath = outPath.replace(/\.json$/i, ".overview.md");
  if (!existsSync(overviewPath)) {
    console.error("Overview smoke test failed: output not created.");
    process.exit(1);
  }
} finally {
  rmSync(projectRoot, { recursive: true, force: true });
}

console.log("CLI smoke test passed.");

const buildRoot = mkdtempSync(path.join(tmpdir(), "ralph-barebones-"));
try {
  mkdirSync(path.join(buildRoot, ".agents", "tasks"), { recursive: true });
  const prdPath = path.join(buildRoot, ".agents", "tasks", "prd.json");
  const prd = {
    version: 1,
    project: "Barebones Smoke Test",
    qualityGates: [],
    stories: [
      { id: "US-001", title: "First story", status: "open", dependsOn: [], acceptanceCriteria: ["Create one file"] },
      { id: "US-002", title: "Second story", status: "open", dependsOn: [], acceptanceCriteria: ["Create another file"] },
    ],
  };
  writeFileSync(prdPath, `${JSON.stringify(prd, null, 2)}\n`);

  run(process.execPath, [cliPath, "build", "--barebones", "--no-commit"], {
    cwd: buildRoot,
    env: { ...process.env, RALPH_DRY_RUN: "1" },
  });

  const runsDir = path.join(buildRoot, ".ralph", "runs");
  const summaries = existsSync(runsDir)
    ? readdirSync(runsDir).filter((name) => name.endsWith(".md") && name.startsWith("run-"))
    : [];
  if (summaries.length !== 1) {
    console.error(`Barebones smoke test failed: expected 1 iteration summary, found ${summaries.length}.`);
    process.exit(1);
  }
} finally {
  rmSync(buildRoot, { recursive: true, force: true });
}

console.log("Barebones CLI smoke test passed.");
