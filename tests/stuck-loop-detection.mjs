import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin", "ralph");

function withWindowsHide(options = {}) {
  return process.platform === "win32" ? { ...options, windowsHide: true } : options;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf-8",
    ...withWindowsHide(options),
  });
  return {
    ...result,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function setupTempProject() {
  const base = mkdtempSync(path.join(tmpdir(), "ralph-stuck-"));
  mkdirSync(path.join(base, ".agents", "tasks"), { recursive: true });
  const prd = {
    version: 1,
    project: "Stuck Loop Test",
    qualityGates: [],
    stories: [
      {
        id: "US-001",
        title: "Failing story",
        status: "open",
        dependsOn: [],
        description: "Keep failing the same verification.",
        acceptanceCriteria: ["Eventually trigger stuck-loop detection."],
      },
    ],
  };
  writeFileSync(path.join(base, ".agents", "tasks", "prd.json"), `${JSON.stringify(prd, null, 2)}\n`);
  writeFileSync(path.join(base, "mock-stuck-agent.js"), [
    "#!/usr/bin/env node",
    "const fs = require(\"fs\");",
    "const promptPath = String(process.argv[2] || \"\").replace(/^\"|\"$/g, \"\");",
    "const prompt = fs.readFileSync(promptPath, \"utf-8\");",
    "const getField = (label) => {",
    "  const prefix = `- ${label}: `;",
    "  const line = prompt.split(/\\r?\\n/).find((entry) => entry.startsWith(prefix));",
    "  return line ? line.slice(prefix.length).trim() : \"\";",
    "};",
    "const runId = getField(\"Run ID\");",
    "const iteration = getField(\"Iteration\");",
    "const storyId = getField(\"ID\");",
    "const storyTitle = getField(\"Title\");",
    "const progressPath = getField(\"Progress Log\");",
    "const entry = [",
    "  `## [mock] - ${storyId}: ${storyTitle}`,",
    "  `Run: ${runId} (iteration ${iteration})`,",
    "  \"No-commit: true\",",
    "  \"Verification:\",",
    "  \"- npm test -> FAIL\",",
    "  \"Outcome:\",",
    "  `- Attempted ${storyId} but verification failed`,",
    "  \"Notes:\",",
    "  \"- avoid rerunning the same failing verification without a real code change.\",",
    "  \"---\",",
    "  \"\",",
    "].join(\"\\n\");",
    "fs.appendFileSync(progressPath, entry);",
    "console.log(\"tokens used\");",
    "console.log(\"42\");",
    "",
  ].join("\n"));
  return base;
}

const projectRoot = setupTempProject();
try {
  const result = run(process.execPath, [cliPath, "build", "5", "--no-commit"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      AGENT_CMD: "node mock-stuck-agent.js {prompt}",
    },
  });
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(`${result.stdout}\n${result.stderr}`, /Stuck-loop detected:/);

  const runsDir = path.join(projectRoot, ".ralph", "runs");
  const reflectionFiles = readdirSync(runsDir).filter((name) => name.endsWith(".reflection.json"));
  assert.equal(reflectionFiles.length, 3);

  const errorsLog = readFileSync(path.join(projectRoot, ".ralph", "errors.log"), "utf-8");
  assert.match(errorsLog, /stuck-loop detected/i);
} finally {
  rmSync(projectRoot, { recursive: true, force: true });
}

console.log("Stuck-loop detection smoke test passed.");
