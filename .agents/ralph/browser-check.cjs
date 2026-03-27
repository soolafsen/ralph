#!/usr/bin/env node
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

function usage() {
  console.log(`Ralph browser check helper

Usage:
  node browser-check.cjs run --url <url> --script <module-path> [--show] [--timeout <ms>] [--screenshot <path>]
  node browser-check.cjs serve-and-run --cwd <dir> --url <url> --ready-url <url> --script <module-path> [--show] [--timeout <ms>] [--log-prefix <name>] -- <server-command> [args...]

The script module must export either:
  export default async function ({ page, browser, context, baseUrl, assert, log }) {}
or:
  export async function run(ctx) {}
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
    url: "",
    readyUrl: "",
    script: "",
    show: false,
    timeoutMs: 15000,
    screenshot: "",
    logPrefix: "browser-check",
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
    if (arg === "--cwd") {
      options.cwd = path.resolve(args[i + 1] || "");
      i += 1;
      continue;
    }
    if (arg === "--url") {
      options.url = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--ready-url") {
      options.readyUrl = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--script") {
      options.script = path.resolve(args[i + 1] || "");
      i += 1;
      continue;
    }
    if (arg === "--show") {
      options.show = true;
      continue;
    }
    if (arg === "--timeout") {
      options.timeoutMs = Number(args[i + 1] || "15000");
      i += 1;
      continue;
    }
    if (arg === "--screenshot") {
      options.screenshot = path.resolve(args[i + 1] || "");
      i += 1;
      continue;
    }
    if (arg === "--log-prefix") {
      options.logPrefix = args[i + 1] || "browser-check";
      i += 1;
      continue;
    }
    throw new Error(`Unknown arg: ${arg}`);
  }

  if (!options.url) throw new Error("--url is required");
  if (!options.script) throw new Error("--script is required");
  return { command, options };
}

function ensureLocalPlaywrightCli() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const cli = process.platform === "win32"
    ? path.join(repoRoot, "node_modules", ".bin", "playwright.cmd")
    : path.join(repoRoot, "node_modules", ".bin", "playwright");
  if (!fs.existsSync(cli)) {
    throw new Error("Ralph Playwright dependency is missing. Run `npm install` in the Ralph repo or reinstall the package.");
  }
  return { repoRoot, cli };
}

function installChromiumIfNeeded(playwrightInfo, executablePath) {
  if (fs.existsSync(executablePath)) return;
  const result = spawnSync(playwrightInfo.cli, ["install", "chromium"], {
    cwd: playwrightInfo.repoRoot,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error("Failed to install Chromium for Ralph browser checks.");
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function quoteForCmd(arg) {
  const value = String(arg);
  if (!value) return "\"\"";
  if (!/[ \t"&()^<>|]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function resolveWindowsCommand(command) {
  if (path.isAbsolute(command) && fs.existsSync(command)) {
    return command;
  }
  const result = spawnSync("where", [command], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  });
  if (result.status !== 0) return "";
  return String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function spawnServer(commandArgs, cwd, stdoutPath, stderrPath) {
  fs.mkdirSync(path.dirname(stdoutPath), { recursive: true });
  const stdoutFd = fs.openSync(stdoutPath, "a");
  const stderrFd = fs.openSync(stderrPath, "a");

  if (process.platform === "win32") {
    const resolved = resolveWindowsCommand(commandArgs[0]);
    if (resolved) {
      return spawn(resolved, commandArgs.slice(1), {
        cwd,
        stdio: ["ignore", stdoutFd, stderrFd],
        windowsHide: true,
        shell: false,
      });
    }
    return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", commandArgs.map(quoteForCmd).join(" ")], {
      cwd,
      stdio: ["ignore", stdoutFd, stderrFd],
      windowsHide: true,
    });
  }

  return spawn(commandArgs[0], commandArgs.slice(1), {
    cwd,
    stdio: ["ignore", stdoutFd, stderrFd],
    windowsHide: true,
  });
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function readTail(filePath, maxBytes = 1000) {
  if (!fs.existsSync(filePath)) return "";
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

async function stopServer(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await new Promise((resolve) => {
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
    return;
  }
  child.kill("SIGTERM");
  await sleep(250);
  if (!child.killed) {
    child.kill("SIGKILL");
  }
}

async function runCheck(options) {
  const playwrightInfo = ensureLocalPlaywrightCli();
  const playwright = await import("playwright");
  installChromiumIfNeeded(playwrightInfo, playwright.chromium.executablePath());

  const browser = await playwright.chromium.launch({
    headless: !options.show,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(options.timeoutMs);
    page.setDefaultNavigationTimeout(options.timeoutMs);

    await page.goto(options.url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: Math.min(options.timeoutMs, 5000) }).catch(() => {});

    const moduleUrl = pathToFileURL(options.script).href;
    const scriptModule = await import(moduleUrl);
    const runner = scriptModule.default || scriptModule.run;
    if (typeof runner !== "function") {
      throw new Error(`Browser check script must export a default async function or named run(): ${options.script}`);
    }

    const log = (...args) => {
      console.log(...args);
    };

    const result = await runner({
      playwright,
      browser,
      context,
      page,
      baseUrl: options.url,
      assert,
      log,
    });

    if (options.screenshot) {
      fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
      await page.screenshot({ path: options.screenshot, fullPage: true });
    }

    if (result !== undefined) {
      console.log(JSON.stringify({ status: "ok", result }, null, 2));
    } else {
      console.log(JSON.stringify({ status: "ok" }, null, 2));
    }
  } finally {
    await browser.close();
  }
}

async function serveAndRun(options) {
  if (!options.childCommand.length) {
    throw new Error("serve-and-run requires a server command after --");
  }
  if (!options.readyUrl) {
    throw new Error("serve-and-run requires --ready-url");
  }

  const runsDir = path.join(options.cwd, ".ralph", "runs");
  fs.mkdirSync(runsDir, { recursive: true });
  const safePrefix = String(options.logPrefix || "browser-check").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const stdoutPath = path.join(runsDir, `${safePrefix}.server.out.log`);
  const stderrPath = path.join(runsDir, `${safePrefix}.server.err.log`);
  fs.writeFileSync(stdoutPath, "");
  fs.writeFileSync(stderrPath, "");

  const server = spawnServer(options.childCommand, options.cwd, stdoutPath, stderrPath);
  try {
    await waitForUrl(options.readyUrl, options.timeoutMs);
    await runCheck(options);
  } catch (error) {
    const stdoutTail = readTail(stdoutPath);
    const stderrTail = readTail(stderrPath);
    const details = [
      error && error.stack ? error.stack : String(error),
      stdoutTail ? `server stdout tail:\n${stdoutTail}` : "",
      stderrTail ? `server stderr tail:\n${stderrTail}` : "",
    ].filter(Boolean);
    throw new Error(details.join("\n\n"));
  } finally {
    await stopServer(server);
  }
}

(async () => {
  try {
    const { command, options } = parseArgs(process.argv);
    if (command === "run") {
      await runCheck(options);
      return;
    }
    if (command === "serve-and-run") {
      await serveAndRun(options);
      return;
    }
    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  }
})();
