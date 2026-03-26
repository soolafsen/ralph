import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const helperPath = path.join(repoRoot, ".agents", "ralph", "process-helper.cjs");

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [helperPath, ...args], {
    encoding: "utf-8",
    windowsHide: true,
    ...options,
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`Command failed: node ${helperPath} ${args.join(" ")}`);
  }
  return result;
}

async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

const projectRoot = mkdtempSync(path.join(tmpdir(), "ralph-process-helper-"));

try {
  mkdirSync(path.join(projectRoot, ".ralph"), { recursive: true });
  const port = await findFreePort();
  const serverScript = path.join(projectRoot, "server.cjs");

  writeFileSync(
    serverScript,
    `const http = require("http");
const port = Number(process.argv[2]);
const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ok");
});
server.listen(port, "127.0.0.1");
`,
  );

  const label = "smoke-server";
  const readyUrl = `http://127.0.0.1:${port}/`;

  run(["start", "--label", label, "--cwd", projectRoot, "--ready-url", readyUrl, "--", process.execPath, serverScript, String(port)]);

  const status = spawnSync(process.execPath, [helperPath, "status", "--label", label, "--cwd", projectRoot, "--ready-url", readyUrl], {
    encoding: "utf-8",
    windowsHide: true,
  });
  if (status.status !== 0) {
    console.error(status.stdout);
    console.error(status.stderr);
    throw new Error("Expected helper status to report a running process.");
  }

  const manifest = JSON.parse(readFileSync(path.join(projectRoot, ".ralph", "processes", `${label}.json`), "utf-8"));
  if (!manifest.pid) {
    throw new Error("Process helper did not record a pid.");
  }

  run(["stop", "--label", label, "--cwd", projectRoot]);

  const finalStatus = spawnSync(process.execPath, [helperPath, "status", "--label", label, "--cwd", projectRoot], {
    encoding: "utf-8",
    windowsHide: true,
  });
  if (finalStatus.status === 0) {
    console.error(finalStatus.stdout);
    throw new Error("Expected helper status to fail after stop.");
  }
} finally {
  rmSync(projectRoot, { recursive: true, force: true });
}

console.log("Process helper smoke test passed.");
