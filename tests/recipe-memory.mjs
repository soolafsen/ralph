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
  const base = mkdtempSync(path.join(tmpdir(), "ralph-recipes-"));
  mkdirSync(path.join(base, ".agents", "tasks"), { recursive: true });
  const prd = {
    version: 1,
    project: "Recipe Test",
    qualityGates: [],
    stories: [
      {
        id: "US-001",
        title: "First verification story",
        status: "open",
        dependsOn: [],
        description: "Use the same verification command repeatedly.",
        acceptanceCriteria: ["Log a passing verification command."],
      },
      {
        id: "US-002",
        title: "Second verification story",
        status: "open",
        dependsOn: [],
        description: "Reuse the same verification command again.",
        acceptanceCriteria: ["Log the same passing verification command."],
      },
      {
        id: "US-003",
        title: "Third verification story",
        status: "open",
        dependsOn: [],
        description: "Allow the trusted recipe to be injected.",
        acceptanceCriteria: ["Finish with the same passing verification command."],
      },
    ],
  };
  writeFileSync(path.join(base, ".agents", "tasks", "prd.json"), `${JSON.stringify(prd, null, 2)}\n`);

  const mockAgentPath = path.join(base, "mock-cli-agent.js");
  writeFileSync(mockAgentPath, [
    "#!/usr/bin/env node",
    "const fs = require(\"fs\");",
    "",
    "const promptPath = String(process.argv[2] || \"\").replace(/^\"|\"$/g, \"\");",
    "const prompt = fs.readFileSync(promptPath, \"utf-8\");",
    "const getField = (label) => {",
    "  const prefix = `- ${label}: `;",
    "  const line = prompt.split(/\\r?\\n/).find((entry) => entry.startsWith(prefix));",
    "  return line ? line.slice(prefix.length).trim() : \"\";",
    "};",
    "",
    "const runId = getField(\"Run ID\");",
    "const iteration = getField(\"Iteration\");",
    "const storyId = getField(\"ID\");",
    "const storyTitle = getField(\"Title\");",
    "const progressPath = getField(\"Progress Log\");",
    "",
    "const entry = [",
    "  \"## [mock] - \" + storyId + \": \" + storyTitle,",
    "  \"Run: \" + runId + \" (iteration \" + iteration + \")\",",
    "  \"No-commit: true\",",
    "  \"Verification:\",",
    "  \"- npm test -> PASS\",",
    "  \"Files changed:\",",
    "  \"- src/\" + storyId + \".txt\",",
    "  \"Outcome:\",",
    "  \"- Completed \" + storyId,",
    "  \"Notes:\",",
    "  \"- npm test is a reliable focused verification command in this repo.\",",
    "  \"---\",",
    "  \"\",",
    "].join(\"\\n\");",
    "",
    "fs.appendFileSync(progressPath, entry);",
    "console.log(\"<run_instructions>\");",
    "console.log(\"npm test\");",
    "console.log(\"</run_instructions>\");",
    "console.log(\"<promise>COMPLETE</promise>\");",
    "console.log(\"tokens used\");",
    "console.log(\"42\");",
    "",
  ].join("\n"));

  return { base, mockAgentPath };
}

function findSingleFile(dirPath, pattern) {
  const match = readdirSync(dirPath).find((name) => pattern.test(name));
  assert.ok(match, `expected file matching ${pattern}`);
  return path.join(dirPath, match);
}

const { base: projectRoot, mockAgentPath } = setupTempProject();
try {
  const result = run(process.execPath, [cliPath, "build", "3", "--no-commit"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      AGENT_CMD: "node mock-cli-agent.js {prompt}",
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const runsDir = path.join(projectRoot, ".ralph", "runs");
  const reflectionFiles = readdirSync(runsDir).filter((name) => name.endsWith(".reflection.json"));
  assert.equal(reflectionFiles.length, 3);

  const recipePath = path.join(projectRoot, ".ralph", "knowledge", "recipes", "fallback-test-npm-test.json");
  const recipe = JSON.parse(readFileSync(recipePath, "utf-8"));
  assert.equal(recipe.kind, "fallback_test_command");
  assert.equal(recipe.successCount, 3);
  assert.equal(recipe.reuseSuccessCount, 2);
  assert.equal(recipe.trusted, true);

  const strategyStatsPath = path.join(projectRoot, ".ralph", "knowledge", "strategy-stats.json");
  const strategyStats = JSON.parse(readFileSync(strategyStatsPath, "utf-8"));
  assert.equal(strategyStats.strategies.tiny_mode.successCount, 3);
  assert.equal(strategyStats.strategies.backend_path.successCount, 3);

  const promptFile = findSingleFile(path.join(projectRoot, ".ralph", ".tmp"), /prompt-.*-3\.md$/);
  const promptText = readFileSync(promptFile, "utf-8");
  assert.match(promptText, /## Known Recipes/);
  assert.match(promptText, /## Strategy Memory/);
  assert.match(promptText, /## Backpressure Hints/);
  assert.match(promptText, /fallback_test_command: Final verification when this repo needs a focused test command\./);
} finally {
  rmSync(projectRoot, { recursive: true, force: true });
}

console.log("Recipe memory smoke test passed.");
