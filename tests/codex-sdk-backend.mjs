import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin", "ralph");
const runnerPath = path.join(repoRoot, ".agents", "ralph", "windows-runner.cjs");
const require = createRequire(import.meta.url);
const { resolveCodexBackend } = require(path.join(repoRoot, ".agents", "ralph", "codex-backend.cjs"));

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf-8",
    ...options,
  });
  return {
    ...result,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function setupTempProject() {
  const base = mkdtempSync(path.join(tmpdir(), "ralph-sdk-"));
  mkdirSync(path.join(base, ".agents", "tasks"), { recursive: true });
  const prd = {
    version: 1,
    project: "SDK Test",
    qualityGates: [],
    stories: [
      {
        id: "US-001",
        title: "SDK Story",
        status: "open",
        dependsOn: [],
        description: "Create one test story.",
        acceptanceCriteria: ["Emit the completion marker after useful work."],
      },
    ],
  };
  writeFileSync(path.join(base, ".agents", "tasks", "prd.json"), `${JSON.stringify(prd, null, 2)}\n`);
  return base;
}

function latestRunArtifacts(projectRoot) {
  const runsDir = path.join(projectRoot, ".ralph", "runs");
  const metricsFile = readdirSync(runsDir)
    .filter((name) => name.endsWith(".metrics.json"))
    .map((name) => path.join(runsDir, name))
    .sort()
    .pop();
  assert.ok(metricsFile, "expected a metrics file");
  const metrics = JSON.parse(readFileSync(metricsFile, "utf-8"));
  const logFile = metricsFile.replace(/\.metrics\.json$/i, ".log");
  return {
    metricsFile,
    metrics,
    logFile,
  };
}

function readPrdStatus(projectRoot) {
  const prd = JSON.parse(readFileSync(path.join(projectRoot, ".agents", "tasks", "prd.json"), "utf-8"));
  return prd.stories[0]?.status || "";
}

async function runSelectionTests() {
  let info = await resolveCodexBackend({
    platform: "win32",
    env: {
      RALPH_AGENT_KIND: "codex",
      RALPH_AGENT_COMMAND_SOURCE: "map",
    },
  });
  assert.equal(info.selected, "sdk");

  info = await resolveCodexBackend({
    platform: "win32",
    env: {
      RALPH_AGENT_KIND: "codex",
      RALPH_AGENT_COMMAND_SOURCE: "map",
      RALPH_TEST_CODEX_SDK_UNAVAILABLE: "1",
    },
  });
  assert.equal(info.selected, "cli");
  assert.match(info.fallbackReason, /unavailable/i);

  info = await resolveCodexBackend({
    platform: "win32",
    env: {
      RALPH_AGENT_KIND: "codex",
      RALPH_AGENT_COMMAND_SOURCE: "map",
      RALPH_TEST_CODEX_SDK_UNAVAILABLE: "1",
      RALPH_CODEX_BACKEND: "sdk",
    },
  });
  assert.equal(info.selected, "sdk");
  assert.match(info.error || "", /requested/i);

  info = await resolveCodexBackend({
    platform: "win32",
    env: {
      RALPH_AGENT_KIND: "codex",
      RALPH_AGENT_COMMAND_SOURCE: "map",
      RALPH_CODEX_BACKEND: "cli",
    },
  });
  assert.equal(info.selected, "cli");
}

function runDoctorSmoke() {
  const result = run(process.execPath, [cliPath, "doctor"], {
    cwd: repoRoot,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Codex backend selection:/);
  assert.match(result.stdout, /Codex backend fallback:/);
}

function runSdkSuccessSmoke() {
  if (process.platform !== "win32") {
    console.log("Skipping Windows SDK runner smoke test on non-Windows.");
    return;
  }
  const projectRoot = setupTempProject();
  try {
    const result = run(process.execPath, [runnerPath, "build", "1", "--no-commit"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        RALPH_ROOT: projectRoot,
        RALPH_QUIET: "1",
        RALPH_CODEX_BACKEND: "sdk",
        RALPH_AGENT_KIND: "codex",
        RALPH_AGENT_COMMAND_SOURCE: "map",
        RALPH_TEST_CODEX_SDK_MOCK: "success",
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Build: story US-001 complete/);
    const { metrics, logFile } = latestRunArtifacts(projectRoot);
    assert.equal(metrics.backend, "sdk");
    assert.equal(metrics.tokenStats.inputTokens, 120);
    assert.equal(readPrdStatus(projectRoot), "done");
    const logText = readFileSync(logFile, "utf-8");
    assert.match(logText, /backend: sdk/);
    assert.match(logText, /session id: mock-thread/);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

function runSdkCompletionHangSmoke() {
  if (process.platform !== "win32") {
    console.log("Skipping Windows SDK completion-hang smoke test on non-Windows.");
    return;
  }
  const projectRoot = setupTempProject();
  try {
    const result = run(process.execPath, [runnerPath, "build", "1", "--no-commit"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        RALPH_ROOT: projectRoot,
        RALPH_QUIET: "1",
        RALPH_CODEX_BACKEND: "sdk",
        RALPH_AGENT_KIND: "codex",
        RALPH_AGENT_COMMAND_SOURCE: "map",
        RALPH_TEST_CODEX_SDK_MOCK: "hang_after_complete",
      },
      timeout: 15000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Build: story US-001 complete/);
    assert.equal(readPrdStatus(projectRoot), "done");
    const { metrics, logFile } = latestRunArtifacts(projectRoot);
    assert.equal(metrics.backend, "sdk");
    const logText = readFileSync(logFile, "utf-8");
    assert.match(logText, /turn completed: input=120 cached=20 output=15/);
    assert.match(logText, /session id: mock-thread/);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

function runAutoFallbackSmoke() {
  if (process.platform !== "win32") {
    console.log("Skipping Windows SDK fallback smoke test on non-Windows.");
    return;
  }
  const projectRoot = setupTempProject();
  try {
    const mockAgentPath = path.join(projectRoot, "mock-cli-agent.cmd");
    writeFileSync(
      mockAgentPath,
      [
        "@echo off",
        "echo mock cli agent",
        "echo ^<run_instructions^>",
        "echo npm test",
        "echo ^</run_instructions^>",
        "echo ^<promise^>COMPLETE^</promise^>",
        "echo tokens used",
        "echo 42",
      ].join("\r\n"),
    );

    const result = run(process.execPath, [runnerPath, "build", "1", "--no-commit"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        RALPH_ROOT: projectRoot,
        RALPH_QUIET: "1",
        RALPH_CODEX_BACKEND: "auto",
        RALPH_AGENT_KIND: "codex",
        RALPH_AGENT_COMMAND_SOURCE: "map",
        RALPH_TEST_CODEX_SDK_MOCK: "startup_error",
        AGENT_CMD: `${mockAgentPath} {prompt}`,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /falling back to CLI/i);
    assert.equal(readPrdStatus(projectRoot), "done");
    const { metrics, logFile } = latestRunArtifacts(projectRoot);
    assert.equal(metrics.backend, "cli");
    const logText = readFileSync(logFile, "utf-8");
    assert.match(logText, /sdk startup error/i);
    assert.match(logText, /falling back to CLI/i);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

await runSelectionTests();
runDoctorSmoke();
runSdkSuccessSmoke();
runSdkCompletionHangSmoke();
runAutoFallbackSmoke();

console.log("Codex SDK backend tests passed.");
