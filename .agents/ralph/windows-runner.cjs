#!/usr/bin/env node
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const args = process.argv.slice(2);
let mode = "build";
let maxIterations = Number(process.env.MAX_ITERATIONS || "25");
let noCommit = String(process.env.NO_COMMIT || "false") === "true";
let prdRequestPath = "";
let prdInline = "";

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "build" || arg === "prd") {
    mode = arg;
    continue;
  }
  if (arg === "--prompt") {
    prdRequestPath = args[i + 1] || "";
    i += 1;
    continue;
  }
  if (arg === "--no-commit") {
    noCommit = true;
    continue;
  }
  if (/^\d+$/.test(arg) && mode !== "prd") {
    maxIterations = Number(arg);
    continue;
  }
  if (mode === "prd") {
    prdInline = prdInline ? `${prdInline} ${arg}` : arg;
    continue;
  }
  console.error(`Unknown arg: ${arg}`);
  process.exit(1);
}

const rootDir = path.resolve(process.env.RALPH_ROOT || process.cwd());
const scriptDir = path.resolve(__dirname);
const configPath = path.join(scriptDir, "config.sh");
const promptFile = path.resolve(process.env.PROMPT_BUILD || path.join(scriptDir, "PROMPT_build.md"));
const prdPath = path.resolve(process.env.PRD_PATH || path.join(rootDir, ".agents", "tasks", "prd.json"));
const progressPath = path.resolve(process.env.PROGRESS_PATH || path.join(rootDir, ".ralph", "progress.md"));
const agentsPath = path.resolve(process.env.AGENTS_PATH || path.join(rootDir, "AGENTS.md"));
const guardrailsPath = path.resolve(process.env.GUARDRAILS_PATH || path.join(rootDir, ".ralph", "guardrails.md"));
const errorsLogPath = path.resolve(process.env.ERRORS_LOG_PATH || path.join(rootDir, ".ralph", "errors.log"));
const activityLogPath = path.resolve(process.env.ACTIVITY_LOG_PATH || path.join(rootDir, ".ralph", "activity.log"));
const tmpDir = path.resolve(process.env.TMP_DIR || path.join(rootDir, ".ralph", ".tmp"));
const runsDir = path.resolve(process.env.RUNS_DIR || path.join(rootDir, ".ralph", "runs"));
const quietMode = String(process.env.RALPH_QUIET || "0") === "1";
const staleSeconds = Number(process.env.STALE_SECONDS || "300");
const progressTailLines = Number(process.env.PROGRESS_TAIL_LINES || "20");
const tinyTaskStoryMax = Number(process.env.TINY_TASK_STORY_MAX || "3");
const tinyTaskModeOverride = process.env.TINY_TASK_MODE_OVERRIDE || "";
const browserVisibility = process.env.RALPH_BROWSER_VISIBILITY || "headless";
const runTag = process.env.RUN_TAG || `${formatCompactDate(new Date())}-${process.pid}`;

const completeMarker = "<promise>COMPLETE</promise>";
const completeGraceMs = Number(process.env.RALPH_COMPLETE_GRACE_SECONDS || "15") * 1000;
const heartbeatSeconds = Number(process.env.RALPH_QUIET_HEARTBEAT_SECONDS || "5");
const idleNoticeSeconds = Number(process.env.RALPH_QUIET_IDLE_NOTICE_SECONDS || "30");
const hangWarningSeconds = Number(process.env.RALPH_HANG_WARNING_SECONDS || "120");

let hasError = false;
let activeChild = null;
let interruptRequested = false;
let forceKillRequested = false;

process.on("SIGINT", () => {
  interruptRequested = true;
  if (activeChild?.pid) {
    killProcessTree(activeChild.pid, forceKillRequested);
    forceKillRequested = true;
  }
});

process.on("SIGTERM", () => {
  interruptRequested = true;
  if (activeChild?.pid) {
    killProcessTree(activeChild.pid, true);
  }
});

function formatCompactDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatLogDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function nowIso() {
  return new Date().toISOString();
}

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function quietEcho(message) {
  if (quietMode) {
    console.log(message);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFile(filePath, content) {
  if (!exists(filePath)) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
  }
}

function commandExists(command) {
  const result = spawnSync("where", [command], {
    stdio: "ignore",
    shell: false,
    windowsHide: true,
  });
  return result.status === 0;
}

function requireAgent(agentCommand) {
  const [agentBin] = splitCommand(agentCommand);
  if (!agentBin) {
    console.error("AGENT_CMD is empty.");
    process.exit(1);
  }
  if (commandExists(agentBin)) return;
  console.error(`Agent command not found: ${agentBin}`);
  process.exit(1);
}

function splitCommand(command) {
  const parts = [];
  let current = "";
  let quote = null;
  let escaping = false;
  for (const char of String(command || "")) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts;
}

function appendLine(filePath, line) {
  fs.appendFileSync(filePath, `${line}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function normalizeStatus(value) {
  if (value == null) return "open";
  return String(value).trim().toLowerCase();
}

function parseConfigShell(filePath) {
  if (!exists(filePath)) return {};
  const text = fs.readFileSync(filePath, "utf-8");
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let [, key, value] = match;
    value = value.trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function buildProgressContext(dstPath, tinyMode) {
  if (tinyMode === "true") {
    fs.writeFileSync(dstPath, "# Progress Snapshot\n\n(skip for tiny task)\n");
    return;
  }
  if (!exists(progressPath)) {
    fs.writeFileSync(dstPath, "# Progress Snapshot\n\n(none)\n");
    return;
  }
  const lines = fs.readFileSync(progressPath, "utf-8").split(/\r?\n/);
  const entries = [];
  let current = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current.length) entries.push(current);
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }
  if (current.length) entries.push(current);
  let text = "";
  if (entries.length) {
    text = entries.slice(-2).map((entry) => entry.join("\n").trim()).filter(Boolean).join("\n\n");
  } else {
    text = lines.slice(-progressTailLines).join("\n").trim();
  }
  if (!text) text = "(none)";
  fs.writeFileSync(dstPath, `# Progress Snapshot\n\n${text}\n`);
}

function selectStory(metaOut, blockOut) {
  if (!exists(prdPath)) {
    fs.writeFileSync(metaOut, `${JSON.stringify({ ok: false, error: "PRD not found" }, null, 2)}\n`);
    fs.writeFileSync(blockOut, "");
    return;
  }
  const data = readJson(prdPath);
  const stories = Array.isArray(data.stories) ? data.stories : null;
  if (!stories || stories.length === 0) {
    fs.writeFileSync(metaOut, `${JSON.stringify({ ok: false, error: "No stories found in PRD" }, null, 2)}\n`);
    fs.writeFileSync(blockOut, "");
    return;
  }
  const storyIndex = new Map();
  for (const story of stories) {
    if (story && typeof story === "object") storyIndex.set(story.id, story);
  }
  const isDone = (storyId) => normalizeStatus(storyIndex.get(storyId)?.status) === "done";
  if (staleSeconds > 0) {
    const now = Date.now();
    for (const story of stories) {
      if (!story || typeof story !== "object") continue;
      if (normalizeStatus(story.status) !== "in_progress") continue;
      const started = story.startedAt ? Date.parse(story.startedAt) : Number.NaN;
      if (!Number.isFinite(started) || (now - started) / 1000 > staleSeconds) {
        story.status = "open";
        story.startedAt = null;
        story.completedAt = null;
        story.updatedAt = nowIso();
      }
    }
  }
  let candidate = null;
  for (const story of stories) {
    if (!story || typeof story !== "object") continue;
    if (normalizeStatus(story.status) !== "open") continue;
    const deps = Array.isArray(story.dependsOn) ? story.dependsOn : [];
    if (deps.every((dep) => isDone(dep))) {
      candidate = story;
      break;
    }
  }
  const remaining = stories.filter((story) => story && typeof story === "object" && normalizeStatus(story.status) !== "done").length;
  const meta = {
    ok: true,
    total: stories.length,
    remaining,
    quality_gates: Array.isArray(data.qualityGates) ? data.qualityGates : [],
  };
  if (candidate) {
    candidate.status = "in_progress";
    if (!candidate.startedAt) candidate.startedAt = nowIso();
    candidate.completedAt = null;
    candidate.updatedAt = nowIso();
    meta.id = candidate.id || "";
    meta.title = candidate.title || "";
    const depends = Array.isArray(candidate.dependsOn) ? candidate.dependsOn : [];
    const acceptance = Array.isArray(candidate.acceptanceCriteria) ? candidate.acceptanceCriteria : [];
    const description = candidate.description || "";
    const lines = [
      `Story: ${candidate.id || ""} - ${candidate.title || ""}`,
      `Depends on: ${depends.length ? depends.join(", ") : "None"}`,
      "",
      "Description:",
      description || "(none)",
      "",
      "Acceptance:",
      ...(acceptance.length ? acceptance.map((item) => `- [ ] ${item}`) : ["- (none)"]),
    ];
    fs.writeFileSync(blockOut, `${lines.join("\n").trimEnd()}\n`);
  } else {
    fs.writeFileSync(blockOut, "");
  }
  writeJson(prdPath, data);
  fs.writeFileSync(metaOut, `${JSON.stringify(meta, null, 2)}\n`);
}

function remainingFromPrd() {
  if (!exists(prdPath)) return "unknown";
  const data = readJson(prdPath);
  const stories = Array.isArray(data.stories) ? data.stories : null;
  if (!stories) return "unknown";
  return String(stories.filter((story) => story && typeof story === "object" && normalizeStatus(story.status) !== "done").length);
}

function storyField(metaFile, field) {
  const data = readJson(metaFile);
  return data[field] || "";
}

function tinyTaskModeFromMeta(metaFile) {
  const data = readJson(metaFile);
  return typeof data.total === "number" && data.total <= tinyTaskStoryMax ? "true" : "false";
}

function updateStoryStatus(storyId, newStatus) {
  if (!storyId || !exists(prdPath)) return;
  const data = readJson(prdPath);
  const stories = Array.isArray(data.stories) ? data.stories : null;
  if (!stories) return;
  for (const story of stories) {
    if (!story || typeof story !== "object" || story.id !== storyId) continue;
    story.status = newStatus;
    story.updatedAt = nowIso();
    if (newStatus === "in_progress") {
      if (!story.startedAt) story.startedAt = nowIso();
      story.completedAt = null;
    } else if (newStatus === "done") {
      if (!story.startedAt) story.startedAt = nowIso();
      story.completedAt = nowIso();
    } else if (newStatus === "open") {
      story.startedAt = null;
      story.completedAt = null;
    }
    break;
  }
  writeJson(prdPath, data);
}

function renderPrompt(srcPath, dstPath, storyMetaPath, storyBlockPath, progressContextPath, tinyTaskMode, iteration, runLog, runMetaPath) {
  let src = fs.readFileSync(srcPath, "utf-8");
  let meta = {};
  try {
    meta = readJson(storyMetaPath);
  } catch {
    meta = {};
  }
  const storyBlock = exists(storyBlockPath) ? fs.readFileSync(storyBlockPath, "utf-8") : "";
  const replacements = {
    REPO_ROOT: rootDir,
    PRD_PATH: prdPath,
    AGENTS_PATH: agentsPath,
    PROGRESS_PATH: progressPath,
    PROGRESS_CONTEXT_PATH: progressContextPath,
    ERRORS_LOG_PATH: errorsLogPath,
    NO_COMMIT: String(noCommit),
    TINY_TASK_MODE: tinyTaskMode,
    RUN_ID: runTag,
    ITERATION: String(iteration),
    RUN_LOG_PATH: runLog,
    RUN_META_PATH: runMetaPath,
    BROWSER_VISIBILITY: browserVisibility,
    STORY_ID: meta.id || "",
    STORY_TITLE: meta.title || "",
    STORY_BLOCK: storyBlock,
    QUALITY_GATES: Array.isArray(meta.quality_gates) && meta.quality_gates.length
      ? meta.quality_gates.map((gate) => `- ${gate}`).join("\n")
      : "- (none)",
  };
  for (const [key, value] of Object.entries(replacements)) {
    src = src.replaceAll(`{{${key}}}`, value);
  }
  fs.writeFileSync(dstPath, src);
}

function logActivity(message) {
  appendLine(activityLogPath, `[${formatLogDate(new Date())}] ${message}`);
}

function logError(message) {
  appendLine(errorsLogPath, `[${formatLogDate(new Date())}] ${message}`);
}

function appendRunSummary(line) {
  const current = exists(activityLogPath) ? fs.readFileSync(activityLogPath, "utf-8").split(/\r?\n/) : [];
  const output = [];
  let inserted = false;
  for (const row of current) {
    output.push(row);
    if (!inserted && row.trim() === "## Run Summary") {
      output.push(`- ${line}`);
      inserted = true;
    }
  }
  if (!inserted) {
    output.unshift("", "## Events", "", "", `- ${line}`, "## Run Summary", "", "# Activity Log");
  }
  fs.writeFileSync(activityLogPath, `${output.join("\n").trimEnd()}\n`);
}

function gitHead() {
  const result = spawnSync("git", ["-C", rootDir, "rev-parse", "HEAD"], { encoding: "utf-8" });
  return result.status === 0 ? String(result.stdout || "").trim() : "";
}

function gitCommitList(before, after) {
  if (!before || !after || before === after) return "";
  const result = spawnSync("git", ["-C", rootDir, "log", "--oneline", `${before}..${after}`], { encoding: "utf-8" });
  return result.status === 0
    ? String(result.stdout || "").split(/\r?\n/).filter(Boolean).map((line) => `- ${line}`).join("\n")
    : "";
}

function gitChangedFiles(before, after) {
  if (!before || !after || before === after) return "";
  const result = spawnSync("git", ["-C", rootDir, "diff", "--name-only", before, after], { encoding: "utf-8" });
  return result.status === 0
    ? String(result.stdout || "").split(/\r?\n/).filter(Boolean).map((line) => `- ${line}`).join("\n")
    : "";
}

function gitDirtyFiles() {
  const result = spawnSync("git", ["-C", rootDir, "status", "--porcelain"], { encoding: "utf-8" });
  return result.status === 0
    ? String(result.stdout || "").split(/\r?\n/).filter(Boolean).map((line) => `- ${line.trim().slice(3)}`).join("\n")
    : "";
}

function writeRunMeta(metaPath, payload) {
  const lines = [
    "# Ralph Run Summary",
    "",
    `- Run ID: ${payload.runId}`,
    `- Iteration: ${payload.iteration}`,
    `- Mode: ${payload.mode}`,
  ];
  if (payload.storyId) lines.push(`- Story: ${payload.storyId}: ${payload.storyTitle}`);
  lines.push(
    `- Started: ${payload.started}`,
    `- Ended: ${payload.ended}`,
    `- Duration: ${payload.duration}s`,
    `- Status: ${payload.status}`,
    `- Log: ${payload.logFile}`,
    "",
    "## Git",
    `- Head (before): ${payload.headBefore || "unknown"}`,
    `- Head (after): ${payload.headAfter || "unknown"}`,
    "",
    "### Commits",
    payload.commitList || "- (none)",
    "",
    "### Changed Files (commits)",
    payload.changedFiles || "- (none)",
    "",
    "### Uncommitted Changes",
    payload.dirtyFiles || "- (clean)",
    "",
  );
  fs.writeFileSync(metaPath, `${lines.join("\n")}\n`);
}

function extractRunInstructions(logFile) {
  if (!exists(logFile)) return "";
  const text = fs.readFileSync(logFile, "utf-8");
  const match = text.match(/<run_instructions>\r?\n([\s\S]*?)\r?\n<\/run_instructions>/);
  return match ? match[1].trim() : "";
}

function printRunInstructions(logFile) {
  const instructions = extractRunInstructions(logFile);
  if (!instructions) return;
  console.log("Run Instructions:");
  console.log(instructions);
}

function hasCompletionMarker(logFile) {
  if (!exists(logFile)) return false;
  return fs.readFileSync(logFile, "utf-8").includes(completeMarker);
}

async function promptInterruptAction(storyId, completePresent) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return completePresent ? "next" : "retry";
  }
  console.log("");
  if (completePresent) {
    console.log(`Interrupted while '${storyId}' already shows a completion marker.`);
    console.log("Choose: [Enter/n] mark done and continue, [r] reset and retry, [k] kill and exit");
  } else {
    console.log(`Interrupted while '${storyId}' has no completion marker yet.`);
    console.log("Choose: [Enter/r] reset and retry, [k] kill and exit");
  }
  const choice = await ask(`Choice [${completePresent ? "n" : "r"}]: `);
  const normalized = String(choice || "").trim().toLowerCase();
  if (!normalized) return completePresent ? "next" : "retry";
  if (["n", "next", "d", "done"].includes(normalized)) return completePresent ? "next" : "retry";
  if (["r", "retry"].includes(normalized)) return "retry";
  if (["k", "kill", "q", "quit", "x", "exit"].includes(normalized)) return "kill";
  return completePresent ? "next" : "retry";
}

function ask(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function killProcessTree(pid, force) {
  if (!pid) return;
  spawnSync("taskkill", ["/PID", String(pid), "/T", force ? "/F" : ""].filter(Boolean), {
    stdio: "ignore",
    windowsHide: true,
  });
}

function createAgentSpawn(command, promptPath) {
  const parts = splitCommand(command);
  if (parts.length === 0) {
    throw new Error("AGENT_CMD is empty.");
  }
  const usesPromptPlaceholder = command.includes("{prompt}");
  const rendered = usesPromptPlaceholder
    ? command.replaceAll("{prompt}", `"${promptPath.replace(/"/g, '\\"')}"`)
    : command;
  return {
    cmd: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", rendered],
    options: {
      shell: false,
      stdio: [usesPromptPlaceholder ? "ignore" : "pipe", "pipe", "pipe"],
      cwd: rootDir,
      env: process.env,
      windowsHide: true,
    },
    stdinPath: usesPromptPlaceholder ? null : promptPath,
  };
}

function runAgentCommand(agentCommand, promptPath, logFile, label) {
  return new Promise((resolve) => {
    let child;
    try {
      const spec = createAgentSpawn(agentCommand, promptPath);
      child = spawn(spec.cmd, spec.args, spec.options);
      activeChild = child;
      if (spec.stdinPath) {
        const input = fs.createReadStream(spec.stdinPath);
        input.on("error", () => {
          child.stdin?.end();
        });
        input.pipe(child.stdin);
      }
    } catch (error) {
      fs.writeFileSync(logFile, `${String(error && error.stack ? error.stack : error)}\n`);
      resolve({ status: 1, interrupted: false, completedAndTerminated: false });
      return;
    }

    ensureDir(path.dirname(logFile));
    const stream = fs.createWriteStream(logFile, { flags: "w" });
    let idleSeconds = 0;
    let lastIdleNoticeBucket = 0;
    let hangWarned = false;
    let completionSeen = false;
    let completionIdleMs = 0;
    let printed = false;
    let completedAndTerminated = false;

    const onChunk = (chunk) => {
      const text = chunk.toString();
      stream.write(text);
      if (!quietMode) {
        process.stdout.write(text);
      }
      if (text.includes(completeMarker)) {
        completionSeen = true;
        completionIdleMs = 0;
      }
      idleSeconds = 0;
      lastIdleNoticeBucket = 0;
      hangWarned = false;
      if (quietMode) {
        if (!printed) {
          process.stdout.write(label);
          printed = true;
        }
        process.stdout.write(".");
      }
    };

    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);

    const heartbeat = setInterval(() => {
      if (!quietMode) return;
      idleSeconds += heartbeatSeconds;
      if (completionSeen) completionIdleMs += heartbeatSeconds * 1000;
      if (completionSeen && completeGraceMs > 0 && completionIdleMs >= completeGraceMs && !completedAndTerminated) {
        if (!printed) {
          process.stdout.write(label);
          printed = true;
        }
        process.stdout.write(` [warning: completion marker seen; forcing runner shutdown after ${Math.floor(completeGraceMs / 1000)}s]`);
        completedAndTerminated = true;
        killProcessTree(child.pid, true);
        return;
      }
      if (hangWarningSeconds > 0 && idleSeconds >= hangWarningSeconds && !hangWarned) {
        if (!printed) {
          process.stdout.write(label);
          printed = true;
        }
        process.stdout.write(` [warning: no new log output for ${hangWarningSeconds}s. Press Ctrl+C for retry/kill options.]`);
        hangWarned = true;
      }
      if (idleNoticeSeconds > 0 && idleSeconds >= idleNoticeSeconds) {
        const bucket = Math.floor(idleSeconds / idleNoticeSeconds);
        if (bucket > lastIdleNoticeBucket) {
          if (!printed) {
            process.stdout.write(label);
            printed = true;
          }
          process.stdout.write(` [idle ${bucket * idleNoticeSeconds}s]`);
          lastIdleNoticeBucket = bucket;
        }
      }
    }, heartbeatSeconds * 1000);

    child.on("close", (code, signal) => {
      clearInterval(heartbeat);
      stream.end();
      if (quietMode && printed) {
        process.stdout.write("\n");
      }
      activeChild = null;
      const interrupted = interruptRequested || signal === "SIGINT" || signal === "SIGTERM";
      if (completedAndTerminated && hasCompletionMarker(logFile)) {
        resolve({ status: 0, interrupted: false, completedAndTerminated: true });
        return;
      }
      resolve({ status: code == null ? 1 : code, interrupted, completedAndTerminated: false });
    });

    child.on("error", (error) => {
      clearInterval(heartbeat);
      stream.write(`${String(error && error.stack ? error.stack : error)}\n`);
      stream.end();
      if (quietMode && printed) {
        process.stdout.write("\n");
      }
      activeChild = null;
      resolve({ status: 1, interrupted: false, completedAndTerminated: false });
    });
  });
}

async function runPrd() {
  const config = parseConfigShell(configPath);
  const prdAgentCommand = process.env.PRD_AGENT_CMD || process.env.AGENT_CMD || config.PRD_AGENT_CMD || config.AGENT_CMD || "codex exec --yolo --skip-git-repo-check -";
  ensureDir(path.dirname(prdPath));
  ensureDir(tmpDir);
  ensureDir(runsDir);

  if (!prdRequestPath && prdInline) {
    prdRequestPath = path.join(tmpDir, `prd-request-${Date.now()}.txt`);
    fs.writeFileSync(prdRequestPath, `${prdInline}\n`);
  }
  if (!prdRequestPath || !exists(prdRequestPath)) {
    console.error("PRD request missing. Provide a prompt string or --prompt <file>.");
    process.exit(1);
  }

  if (process.env.RALPH_DRY_RUN === "1") {
    if (prdPath.endsWith(".json") && !exists(prdPath)) {
      writeJson(prdPath, { version: 1, project: "ralph", qualityGates: [], stories: [] });
    }
    process.exit(0);
  }

  requireAgent(prdAgentCommand);

  const prdPromptFile = path.join(tmpDir, `prd-prompt-${Date.now()}.md`);
  const prdLogFile = path.join(runsDir, `prd-${runTag}.log`);
  const lines = [
    "You are an autonomous coding agent.",
    "Use the $prd skill to create a Product Requirements Document in JSON.",
    prdPath.endsWith(".json") ? `Save the PRD to: ${prdPath}` : `Save the PRD as JSON in directory: ${prdPath}`,
  ];
  if (!prdPath.endsWith(".json")) {
    lines.push("Filename rules: prd-<short-slug>.json using 1-3 meaningful words.");
    lines.push("Examples: prd-workout-tracker.json, prd-usage-billing.json");
  }
  lines.push("Do NOT implement anything.");
  lines.push("After creating the PRD, end with:");
  lines.push("PRD JSON saved to <path>. Close this chat and run `ralph build`.");
  lines.push("");
  lines.push("User request:");
  lines.push(fs.readFileSync(prdRequestPath, "utf-8"));
  fs.writeFileSync(prdPromptFile, `${lines.join("\n")}\n`);

  if (quietMode) quietEcho("PRD: starting");
  const result = await runAgentCommand(prdAgentCommand, prdPromptFile, prdLogFile, "PRD: working");
  if (quietMode) {
    quietEcho(result.status === 0 ? `PRD: complete (full log: ${prdLogFile})` : `PRD: failed (full log: ${prdLogFile})`);
  }
  process.exit(result.status);
}

function initializeFiles() {
  ensureDir(tmpDir);
  ensureDir(runsDir);
  ensureFile(progressPath, `# Progress Log\nStarted: ${new Date().toString()}\n\n## Codebase Patterns\n- (add reusable patterns here)\n\n---\n`);
  ensureFile(guardrailsPath, "# Guardrails (Signs)\n\n> Lessons learned from failures. Read before acting.\n\n## Core Signs\n\n### Sign: Read Before Writing\n- **Trigger**: Before modifying any file\n- **Instruction**: Read the file first\n- **Added after**: Core principle\n\n### Sign: Test Before Commit\n- **Trigger**: Before committing changes\n- **Instruction**: Run required tests and verify outputs\n- **Added after**: Core principle\n\n---\n\n## Learned Signs\n\n");
  ensureFile(errorsLogPath, "# Error Log\n\n> Failures and repeated issues. Use this to add guardrails.\n\n");
  ensureFile(activityLogPath, "# Activity Log\n\n## Run Summary\n\n## Events\n\n");
}

async function runBuild() {
  const config = parseConfigShell(configPath);
  const agentCommand = process.env.AGENT_CMD || config.AGENT_CMD || "codex exec --yolo --skip-git-repo-check -";
  if (process.env.RALPH_DRY_RUN !== "1") {
    requireAgent(agentCommand);
  }
  initializeFiles();

  if (quietMode) {
    quietEcho("Build: start");
  } else {
    console.log(`Ralph mode: ${mode}`);
    console.log(`Max iterations: ${maxIterations}`);
    console.log(`PRD: ${prdPath}`);
  }

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    if (quietMode) {
      quietEcho(`Build: iteration ${iteration}/${maxIterations}`);
    } else {
      console.log("");
      console.log("-------------------------------------------------------");
      console.log(`  Ralph Iteration ${iteration} of ${maxIterations}`);
      console.log("-------------------------------------------------------");
    }

    const storyMeta = path.join(tmpDir, `story-${runTag}-${iteration}.json`);
    const storyBlock = path.join(tmpDir, `story-${runTag}-${iteration}.md`);
    selectStory(storyMeta, storyBlock);
    const meta = readJson(storyMeta);
    const remaining = String(meta.remaining ?? "unknown");
    if (remaining === "unknown") {
      console.error(`Could not parse stories from PRD: ${prdPath}`);
      process.exit(1);
    }
    if (remaining === "0") {
      console.log("No remaining stories.");
      process.exit(0);
    }
    const storyId = storyField(storyMeta, "id");
    const storyTitle = storyField(storyMeta, "title");
    if (!storyId) {
      console.log(`No actionable open stories (all blocked or in progress). Remaining: ${remaining}`);
      process.exit(0);
    }

    const iterStart = Date.now();
    const iterStartFmt = formatLogDate(new Date(iterStart));
    const headBefore = gitHead();
    const promptRendered = path.join(tmpDir, `prompt-${runTag}-${iteration}.md`);
    const progressContext = path.join(tmpDir, `progress-${runTag}-${iteration}.md`);
    const logFile = path.join(runsDir, `run-${runTag}-iter-${iteration}.log`);
    const runMeta = path.join(runsDir, `run-${runTag}-iter-${iteration}.md`);
    const tinyTaskMode = tinyTaskModeOverride || tinyTaskModeFromMeta(storyMeta);
    buildProgressContext(progressContext, tinyTaskMode);
    renderPrompt(promptFile, promptRendered, storyMeta, storyBlock, progressContext, tinyTaskMode, iteration, logFile, runMeta);

    logActivity(`ITERATION ${iteration} start (mode=${mode} story=${storyId})`);
    interruptRequested = false;
    forceKillRequested = false;

    let result;
    if (process.env.RALPH_DRY_RUN === "1") {
      fs.writeFileSync(logFile, "[RALPH_DRY_RUN] Skipping agent execution.\n");
      if (quietMode) quietEcho("Build: dry-run");
      result = { status: 0, interrupted: false, completedAndTerminated: false };
    } else {
      result = await runAgentCommand(agentCommand, promptRendered, logFile, "Build: working");
    }

    const iterEnd = Date.now();
    const iterEndFmt = formatLogDate(new Date(iterEnd));
    const iterDuration = Math.floor((iterEnd - iterStart) / 1000);
    const headAfter = gitHead();
    logActivity(`ITERATION ${iteration} end (duration=${iterDuration}s)`);

    const interrupted = result.interrupted || result.status === 130 || result.status === 143;
    if (result.status !== 0 && !interrupted) {
      logError(`ITERATION ${iteration} command failed (status=${result.status})`);
      hasError = true;
    }

    const commitList = gitCommitList(headBefore, headAfter);
    const changedFiles = gitChangedFiles(headBefore, headAfter);
    const dirtyFiles = gitDirtyFiles();
    const statusLabel = interrupted ? "interrupted" : result.status !== 0 ? "error" : "success";
    if (!noCommit && dirtyFiles && !interrupted) {
      logError(`ITERATION ${iteration} left uncommitted changes; review run summary at ${runMeta}`);
    }

    writeRunMeta(runMeta, {
      runId: runTag,
      iteration,
      mode,
      storyId,
      storyTitle,
      started: iterStartFmt,
      ended: iterEndFmt,
      duration: iterDuration,
      status: statusLabel,
      logFile,
      headBefore,
      headAfter,
      commitList,
      changedFiles,
      dirtyFiles,
    });

    appendRunSummary(`${formatLogDate(new Date())} | run=${runTag} | iter=${iteration} | mode=${mode} | story=${storyId} | duration=${iterDuration}s | status=${statusLabel}`);

    if (interrupted) {
      const completePresent = hasCompletionMarker(logFile);
      const interruptAction = await promptInterruptAction(storyId, completePresent);
      if (interruptAction === "next") {
        updateStoryStatus(storyId, "done");
        logError(`ITERATION ${iteration} interrupted after completion marker; story marked done and continuing`);
        if (quietMode) {
          quietEcho(`Build: interrupted after completion marker; marked ${storyId} done`);
        } else {
          console.log("Interrupted after completion marker; story marked done.");
        }
      } else if (interruptAction === "retry") {
        updateStoryStatus(storyId, "open");
        logError(`ITERATION ${iteration} interrupted before completion; story reset to open and retrying`);
        if (quietMode) {
          quietEcho(`Build: interrupted; reset ${storyId} to open for retry`);
        } else {
          console.log("Interrupted; story reset to open for retry.");
        }
        await sleep(2000);
        continue;
      } else {
        if (quietMode) quietEcho(`Build: killed during ${storyId}; story state left unchanged`);
        console.log("Interrupted.");
        process.exit(result.status || 130);
      }
    } else if (result.status !== 0) {
      logError(`ITERATION ${iteration} exited non-zero; review ${logFile}`);
      updateStoryStatus(storyId, "open");
      if (quietMode) {
        quietEcho(`Build: story ${storyId} failed`);
      } else {
        console.log("Iteration failed; story reset to open.");
      }
    } else if (hasCompletionMarker(logFile)) {
      updateStoryStatus(storyId, "done");
      if (quietMode) {
        quietEcho(`Build: story ${storyId} complete`);
      } else {
        console.log("Completion signal received; story marked done.");
      }
    } else {
      updateStoryStatus(storyId, "open");
      if (quietMode) {
        quietEcho(`Build: story ${storyId} incomplete`);
      } else {
        console.log("No completion signal; story reset to open.");
      }
    }

    const remainingAfter = remainingFromPrd();
    if (quietMode) {
      quietEcho(`Build: remaining stories ${remainingAfter}`);
      quietEcho(`Build: log ${logFile}`);
    } else {
      console.log(`Iteration ${iteration} complete. Remaining stories: ${remainingAfter}`);
    }

    if (remainingAfter === "0") {
      printRunInstructions(logFile);
      if (quietMode) {
        quietEcho("Build: complete");
      } else {
        console.log("No remaining stories.");
      }
      process.exit(0);
    }

    await sleep(2000);
  }

  if (quietMode) {
    quietEcho(`Build: reached max iterations (${maxIterations})`);
  } else {
    console.log(`Reached max iterations (${maxIterations}).`);
  }
  process.exit(hasError ? 1 : 0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  if (mode === "prd") {
    await runPrd();
    return;
  }
  await runBuild();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
