#!/usr/bin/env node
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function usage() {
  console.log(`Ralph process helper

Usage:
  node process-helper.cjs start --label <name> [--cwd <dir>] [--ready-url <url>] [--ready-timeout <seconds>] -- <command> [args...]
  node process-helper.cjs status --label <name> [--cwd <dir>] [--ready-url <url>]
  node process-helper.cjs stop --label <name> [--cwd <dir>] [--stop-timeout <seconds>]
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args.shift();
  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(0);
  }

  const options = {
    cwd: process.cwd(),
    readyTimeoutSeconds: 60,
    stopTimeoutSeconds: 8,
    readyUrl: "",
    label: "",
    childCommand: [],
  };

  let passthrough = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (passthrough) {
      options.childCommand.push(arg);
      continue;
    }
    if (arg === "--") {
      passthrough = true;
      continue;
    }
    if (arg === "--label") {
      options.label = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--cwd") {
      options.cwd = path.resolve(args[i + 1] || "");
      i += 1;
      continue;
    }
    if (arg === "--ready-url") {
      options.readyUrl = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--ready-timeout") {
      options.readyTimeoutSeconds = Number(args[i + 1] || "60");
      i += 1;
      continue;
    }
    if (arg === "--stop-timeout") {
      options.stopTimeoutSeconds = Number(args[i + 1] || "8");
      i += 1;
      continue;
    }
    throw new Error(`Unknown arg: ${arg}`);
  }

  if (!options.label) {
    throw new Error("--label is required");
  }

  return { command, options };
}

function sanitizeLabel(label) {
  return String(label).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function statePaths(baseDir, label) {
  const safe = sanitizeLabel(label);
  const stateDir = path.join(baseDir, ".ralph", "processes");
  const runsDir = path.join(baseDir, ".ralph", "runs");
  ensureDir(stateDir);
  ensureDir(runsDir);
  return {
    manifest: path.join(stateDir, `${safe}.json`),
    stdout: path.join(runsDir, `${safe}.out.log`),
    stderr: path.join(runsDir, `${safe}.err.log`),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function isProcessAlive(pid) {
  if (!pid) return false;
  if (process.platform === "win32") {
    const result = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
      encoding: "utf-8",
      windowsHide: true,
    });
    if (result.status !== 0) return false;
    const output = String(result.stdout || "").trim();
    return output.length > 0 && !output.startsWith("INFO:");
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function quoteForCmd(arg) {
  const value = String(arg);
  if (!value) return "\"\"";
  if (!/[ \t"&()^<>|]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function buildSpawnSpec(childCommand, cwd, stdoutPath, stderrPath) {
  const stdoutFd = fs.openSync(stdoutPath, "a");
  const stderrFd = fs.openSync(stderrPath, "a");
  if (process.platform === "win32") {
    const cmdLine = childCommand.map(quoteForCmd).join(" ");
    return {
      file: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", cmdLine],
      options: {
        cwd,
        detached: true,
        windowsHide: true,
        stdio: ["ignore", stdoutFd, stderrFd],
        env: process.env,
      },
    };
  }
  return {
    file: childCommand[0],
    args: childCommand.slice(1),
    options: {
      cwd,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", stdoutFd, stderrFd],
      env: process.env,
    },
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isReady(manifest, overrideUrl = "") {
  const readyUrl = overrideUrl || manifest.readyUrl || "";
  if (!readyUrl) {
    return isProcessAlive(manifest.pid);
  }
  try {
    const response = await fetch(readyUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

function readTail(filePath, maxBytes = 800) {
  if (!exists(filePath)) return "";
  const stats = fs.statSync(filePath);
  const start = Math.max(0, stats.size - maxBytes);
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(stats.size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    return buffer.toString("utf-8").trim();
  } finally {
    fs.closeSync(fd);
  }
}

async function waitForReady(manifest, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    if (!isProcessAlive(manifest.pid)) {
      return false;
    }
    if (await isReady(manifest)) {
      return true;
    }
    await sleep(400);
  }
  return await isReady(manifest);
}

async function startProcess(options) {
  if (!options.childCommand.length) {
    throw new Error("Missing child command after --");
  }
  const paths = statePaths(options.cwd, options.label);
  if (exists(paths.manifest)) {
    const current = readJson(paths.manifest);
    if (isProcessAlive(current.pid) && (await isReady(current, options.readyUrl))) {
      console.log(JSON.stringify({ status: "reused", ...current }, null, 2));
      return;
    }
    try {
      fs.rmSync(paths.manifest, { force: true });
    } catch {}
  }

  ensureDir(path.dirname(paths.stdout));
  ensureDir(path.dirname(paths.stderr));
  fs.writeFileSync(paths.stdout, "");
  fs.writeFileSync(paths.stderr, "");

  const spec = buildSpawnSpec(options.childCommand, options.cwd, paths.stdout, paths.stderr);
  const child = spawn(spec.file, spec.args, spec.options);
  child.unref();

  const manifest = {
    label: options.label,
    cwd: options.cwd,
    pid: child.pid,
    readyUrl: options.readyUrl,
    startedAt: new Date().toISOString(),
    stdout: paths.stdout,
    stderr: paths.stderr,
    command: options.childCommand,
  };
  writeJson(paths.manifest, manifest);

  const ready = await waitForReady(manifest, options.readyTimeoutSeconds);
  if (!ready) {
    const stderrTail = readTail(paths.stderr);
    const stdoutTail = readTail(paths.stdout);
    throw new Error(
      [
        `Process '${options.label}' did not become ready within ${options.readyTimeoutSeconds}s.`,
        stdoutTail ? `stdout tail:\n${stdoutTail}` : "",
        stderrTail ? `stderr tail:\n${stderrTail}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  console.log(JSON.stringify({ status: "started", ...manifest }, null, 2));
}

async function statusProcess(options) {
  const paths = statePaths(options.cwd, options.label);
  if (!exists(paths.manifest)) {
    console.log(JSON.stringify({ status: "missing", label: options.label }, null, 2));
    process.exit(1);
  }
  const manifest = readJson(paths.manifest);
  const alive = isProcessAlive(manifest.pid);
  const ready = alive ? await isReady(manifest, options.readyUrl) : false;
  console.log(JSON.stringify({ status: alive ? "running" : "stale", ready, ...manifest }, null, 2));
  process.exit(alive ? 0 : 1);
}

async function waitForExit(pid, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return true;
    await sleep(250);
  }
  return !isProcessAlive(pid);
}

async function stopProcess(options) {
  const paths = statePaths(options.cwd, options.label);
  if (!exists(paths.manifest)) {
    console.log(JSON.stringify({ status: "missing", label: options.label }, null, 2));
    return;
  }
  const manifest = readJson(paths.manifest);
  const pid = manifest.pid;

  if (isProcessAlive(pid)) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(pid), "/T"], { stdio: "ignore", windowsHide: true });
      if (!(await waitForExit(pid, options.stopTimeoutSeconds))) {
        spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
        await waitForExit(pid, 2);
      }
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        try {
          process.kill(pid, "SIGTERM");
        } catch {}
      }
      if (!(await waitForExit(pid, options.stopTimeoutSeconds))) {
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          try {
            process.kill(pid, "SIGKILL");
          } catch {}
        }
      }
    }
  }

  try {
    fs.rmSync(paths.manifest, { force: true });
  } catch {}

  console.log(JSON.stringify({ status: "stopped", label: options.label, pid }, null, 2));
}

(async () => {
  try {
    const { command, options } = parseArgs(process.argv);
    if (command === "start") {
      await startProcess(options);
      return;
    }
    if (command === "status") {
      await statusProcess(options);
      return;
    }
    if (command === "stop") {
      await stopProcess(options);
      return;
    }
    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  }
})();
