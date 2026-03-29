import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readdirSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
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

function runCapture(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, withWindowsHide({
    encoding: "utf-8",
    ...options,
  }));
  if (result.status !== 0) {
    console.error(result.stdout || "");
    console.error(result.stderr || "");
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
  return {
    ...result,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin", "ralph");

run(process.execPath, [cliPath, "--help"]);

const projectRoot = mkdtempSync(path.join(tmpdir(), "ralph-cli-"));
try {
  const outPath = path.join(projectRoot, "prd.json");
  const mockPrdAgentPath = path.join(projectRoot, "mock-prd-agent.cjs");
  writeFileSync(
    mockPrdAgentPath,
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const promptPath = String(process.argv[2] || '').replace(/^\"|\"$/g, '');",
      "const prompt = fs.readFileSync(promptPath, 'utf-8');",
      "if (!prompt.includes('Every story must include a non-empty `description` field.')) process.exit(11);",
      "if (!prompt.includes('Keep each story `description` capped to one or two short lines.')) process.exit(12);",
      "if (!prompt.includes('Do not emit multi-paragraph or obviously verbose story descriptions.')) process.exit(13);",
      "const match = prompt.match(/^Save the PRD to: (.+)$/m);",
      "if (!match) process.exit(14);",
      "const outPath = match[1].trim();",
      "const prd = {",
      "  version: 1,",
      "  project: 'Smoke test PRD',",
      "  qualityGates: ['npm test'],",
      "  stories: [",
      "    {",
      "      id: 'US-001',",
      "      title: 'Compact story description',",
      "      status: 'open',",
      "      dependsOn: [],",
      "      description: 'Write a compact story summary.\\nKeep it brief in the JSON output.',",
      "      acceptanceCriteria: [",
      "        'Example: generated stories include descriptions.',",
      "        'Negative case: descriptions do not become verbose paragraphs.',",
      "      ],",
      "    },",
      "    {",
      "      id: 'US-002',",
      "      title: 'Second compact story',",
      "      status: 'open',",
      "      dependsOn: ['US-001'],",
      "      description: 'Add another short summary.\\nKeep it compact for JSON output.',",
      "      acceptanceCriteria: [",
      "        'Example: every generated story includes a description.',",
      "        'Negative case: a later story is not missing its description.',",
      "      ],",
      "    },",
      "  ],",
      "};",
      "fs.mkdirSync(path.dirname(outPath), { recursive: true });",
      "fs.writeFileSync(outPath, `${JSON.stringify(prd, null, 2)}\\n`);",
      "console.log(`PRD JSON saved to ${outPath}`);",
    ].join("\n"),
  );

  run(process.execPath, [cliPath, "prd", "Smoke test PRD", "--out", outPath], {
    cwd: projectRoot,
    env: { ...process.env, PRD_AGENT_CMD: `node ${mockPrdAgentPath} {prompt}` },
  });

  if (!existsSync(outPath)) {
    console.error("PRD smoke test failed: output not created.");
    process.exit(1);
  }
  const generatedPrd = JSON.parse(readFileSync(outPath, "utf-8"));
  assert.equal(Array.isArray(generatedPrd.stories), true);
  assert.ok(generatedPrd.stories.length >= 2);
  for (const story of generatedPrd.stories) {
    assert.equal(typeof story?.description, "string");
    assert.notEqual(story.description.trim(), "");
    const descriptionLines = story.description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    assert.ok(descriptionLines.length <= 2);
    for (const line of descriptionLines) {
      assert.ok(line.length <= 80);
    }
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

const quietBuildRoot = mkdtempSync(path.join(tmpdir(), "ralph-quiet-build-"));
try {
  mkdirSync(path.join(quietBuildRoot, ".agents", "tasks"), { recursive: true });
  const prdPath = path.join(quietBuildRoot, ".agents", "tasks", "prd.json");
  const mockAgentPath = path.join(quietBuildRoot, "mock-build-agent.cjs");
  const storyDescription = "Write a compact story summary.\nKeep it brief in the JSON output.";
  writeFileSync(prdPath, `${JSON.stringify({
    version: 1,
    project: "Quiet Build Smoke Test",
    qualityGates: [],
    stories: [
      {
        id: "US-001",
        title: "Compact story description",
        status: "open",
        dependsOn: [],
        description: storyDescription,
        acceptanceCriteria: ["Emit the completion marker."],
      },
    ],
  }, null, 2)}\n`);
  writeFileSync(
    mockAgentPath,
    [
      "console.log('<promise>COMPLETE</promise>');",
      "console.log('<run_instructions>');",
      "console.log('npm test');",
      "console.log('</run_instructions>');",
    ].join("\n"),
  );

  const quietResult = runCapture(process.execPath, [cliPath, "build", "1", "--quiet", "--no-commit"], {
    cwd: quietBuildRoot,
    env: { ...process.env, AGENT_CMD: `node ${mockAgentPath} {prompt}`, RALPH_CODEX_BACKEND: "cli", RALPH_QUIET: "1" },
  });
  assert.match(
    quietResult.stdout,
    /\[\d{2}:\d{2}:\d{2}\] Build: story US-001 - Compact story description\r?\n\[\d{2}:\d{2}:\d{2}\]   Write a compact story summary\.\r?\n\[\d{2}:\d{2}:\d{2}\]   Keep it brief in the JSON output\./,
  );

  const nonQuietRoot = mkdtempSync(path.join(tmpdir(), "ralph-normal-build-"));
  try {
    mkdirSync(path.join(nonQuietRoot, ".agents", "tasks"), { recursive: true });
    writeFileSync(prdPath.replace(quietBuildRoot, nonQuietRoot), `${JSON.stringify({
      version: 1,
      project: "Normal Build Smoke Test",
      qualityGates: [],
      stories: [
        {
          id: "US-001",
          title: "Compact story description",
          status: "open",
          dependsOn: [],
          description: storyDescription,
          acceptanceCriteria: ["Emit the completion marker."],
        },
      ],
    }, null, 2)}\n`);
    const nonQuietResult = runCapture(process.execPath, [cliPath, "build", "1", "--no-commit"], {
      cwd: nonQuietRoot,
      env: { ...process.env, AGENT_CMD: `node ${mockAgentPath} {prompt}`, RALPH_CODEX_BACKEND: "cli", RALPH_QUIET: "0" },
    });
    assert.doesNotMatch(nonQuietResult.stdout, /Write a compact story summary\./);
    assert.doesNotMatch(nonQuietResult.stdout, /Keep it brief in the JSON output\./);
  } finally {
    rmSync(nonQuietRoot, { recursive: true, force: true });
  }
} finally {
  rmSync(quietBuildRoot, { recursive: true, force: true });
}

console.log("Quiet build CLI smoke test passed.");
