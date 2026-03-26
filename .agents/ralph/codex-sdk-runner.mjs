#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Codex } from "@openai/codex-sdk";

function formatClockTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeLine(stream, line = "") {
  stream.write(`${line}\n`);
}

function closeLogStream(stream) {
  return new Promise((resolve) => {
    stream.end(resolve);
  });
}

function hasStandaloneLine(text, needle) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === needle);
}

function makeTokenStats(usage) {
  if (!usage) return null;
  const inputTokens = Number(usage.input_tokens || 0);
  const cachedInputTokens = Number(usage.cached_input_tokens || 0);
  const outputTokens = Number(usage.output_tokens || 0);
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  return {
    inputTokens,
    cachedInputTokens,
    uncachedInputTokens,
    outputTokens,
    reasoningOutputTokens: null,
    totalTokens: uncachedInputTokens + outputTokens,
    rawTotalTokens: inputTokens + outputTokens,
  };
}

function formatItem(item) {
  if (!item || typeof item !== "object") return "";
  switch (item.type) {
    case "agent_message":
      return item.text || "";
    case "reasoning":
      return item.text || "";
    case "command_execution":
      return `${item.status || "unknown"}: ${item.command || ""}`.trim();
    case "file_change":
      return `${item.status || "unknown"}: ${(item.changes || []).map((change) => `${change.kind} ${change.path}`).join(", ")}`.trim();
    case "mcp_tool_call":
      return `${item.status || "unknown"}: ${item.server || ""}/${item.tool || ""}`.trim();
    case "todo_list":
      return (item.items || [])
        .map((entry) => `- [${entry.completed ? "x" : " "}] ${entry.text}`)
        .join("\n");
    case "web_search":
      return item.query || "";
    case "error":
      return item.message || "";
    default:
      return JSON.stringify(item);
  }
}

function writeEvent(stream, event) {
  if (!event || typeof event !== "object") return;
  switch (event.type) {
    case "thread.started":
      writeLine(stream, `thread started: ${event.thread_id}`);
      return;
    case "turn.started":
      writeLine(stream, "turn started");
      return;
    case "turn.completed":
      writeLine(
        stream,
        `turn completed: input=${event.usage?.input_tokens || 0} cached=${event.usage?.cached_input_tokens || 0} output=${event.usage?.output_tokens || 0}`,
      );
      return;
    case "turn.failed":
      writeLine(stream, `turn failed: ${event.error?.message || "unknown error"}`);
      return;
    case "item.started":
    case "item.updated":
    case "item.completed":
      writeLine(stream, `${event.type}: ${event.item?.type || "item"}`);
      {
        const text = formatItem(event.item);
        if (text) {
          for (const line of String(text).split(/\r?\n/)) {
            writeLine(stream, line);
          }
        }
      }
      return;
    case "error":
      writeLine(stream, `stream error: ${event.message || "unknown error"}`);
      return;
    default:
      writeLine(stream, JSON.stringify(event));
  }
}

async function runMockTurn({
  controller,
  env,
  quietMode,
  label,
  heartbeatSeconds,
  idleNoticeSeconds,
  hangWarningSeconds,
  completeMarker,
  logStream,
  promptText,
}) {
  const mode = env.RALPH_TEST_CODEX_SDK_MOCK || "";
  if (mode === "startup_error") {
    const error = new Error("mock sdk startup failure");
    error.allowFallback = true;
    throw error;
  }

  let printed = false;
  let idleSeconds = 0;
  let lastIdleNoticeBucket = 0;
  let hangWarned = false;
  let done = false;

  const printProgress = () => {
    if (!quietMode) return;
    if (!printed) {
      process.stdout.write(`[${formatClockTime(new Date())}] ${label}`);
      printed = true;
    }
    process.stdout.write(".");
  };

  const heartbeat = setInterval(() => {
    if (done || !quietMode) return;
    idleSeconds += heartbeatSeconds;
    if (hangWarningSeconds > 0 && idleSeconds >= hangWarningSeconds && !hangWarned) {
      if (!printed) {
        process.stdout.write(`[${formatClockTime(new Date())}] ${label}`);
        printed = true;
      }
      process.stdout.write(` [warning: no new SDK event for ${hangWarningSeconds}s. Press Ctrl+C for retry/kill options.]`);
      hangWarned = true;
    }
    if (idleNoticeSeconds > 0 && idleSeconds >= idleNoticeSeconds) {
      const bucket = Math.floor(idleSeconds / idleNoticeSeconds);
      if (bucket > lastIdleNoticeBucket) {
        if (!printed) {
          process.stdout.write(`[${formatClockTime(new Date())}] ${label}`);
          printed = true;
        }
        process.stdout.write(` [thinking ${bucket * idleNoticeSeconds}s]`);
        lastIdleNoticeBucket = bucket;
      }
    }
  }, heartbeatSeconds * 1000);

  const waitWithAbort = (ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", onAbort);
      const error = new Error("mock sdk run aborted");
      error.name = "AbortError";
      reject(error);
    };
    controller.signal.addEventListener("abort", onAbort);
  });

  try {
    writeLine(logStream, "thread started: mock-thread");
    printProgress();
    await waitWithAbort(25);
    idleSeconds = 0;
    lastIdleNoticeBucket = 0;
    hangWarned = false;
    writeLine(logStream, "turn started");
    printProgress();
    await waitWithAbort(25);
    writeLine(logStream, "item.completed: agent_message");
    const finalResponse = env.RALPH_TEST_CODEX_SDK_FINAL_RESPONSE || `Mock SDK response\n${completeMarker}`;
    writeLine(logStream, finalResponse);
    writeLine(logStream, "turn completed: input=120 cached=20 output=15");
    writeLine(logStream, "");
    writeLine(logStream, "final response:");
    writeLine(logStream, finalResponse);
    writeLine(logStream, "");
    writeLine(logStream, "session id: mock-thread");
    writeLine(logStream, "tokens used");
    writeLine(logStream, "115");
    return {
      status: 0,
      interrupted: false,
      completed: hasStandaloneLine(finalResponse, completeMarker),
      completedAndTerminated: false,
      backend: "sdk",
      threadId: "mock-thread",
      finalResponse,
      tokenStats: makeTokenStats({
        input_tokens: 120,
        cached_input_tokens: 20,
        output_tokens: 15,
      }),
    };
  } finally {
    done = true;
    clearInterval(heartbeat);
    if (quietMode && printed) {
      process.stdout.write("\n");
    }
  }
}

export async function runCodexSdkTurn(options) {
  const {
    promptPath,
    logFile,
    label,
    quietMode,
    rootDir,
    env = process.env,
    completeMarker,
    heartbeatSeconds,
    idleNoticeSeconds,
    hangWarningSeconds,
    modelReasoningEffort = "medium",
    model,
    onController,
  } = options;

  const promptText = options.promptText ?? fs.readFileSync(promptPath, "utf-8");
  ensureDir(path.dirname(logFile));
  const logStream = fs.createWriteStream(logFile, { flags: "w" });
  writeLine(logStream, "backend: sdk");
  writeLine(logStream, `started: ${new Date().toISOString()}`);
  writeLine(logStream, `prompt path: ${promptPath}`);
  writeLine(logStream, "");
  writeLine(logStream, "prompt:");
  writeLine(logStream, promptText.trimEnd());
  writeLine(logStream, "");
  writeLine(logStream, "events:");

  const controller = new AbortController();
  if (typeof onController === "function") {
    onController(controller);
  }

  if (env.RALPH_TEST_CODEX_SDK_MOCK) {
    try {
      return await runMockTurn({
        controller,
        env,
        quietMode,
        label,
        heartbeatSeconds,
        idleNoticeSeconds,
        hangWarningSeconds,
        completeMarker,
        logStream,
        promptText,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        writeLine(logStream, `sdk interrupted: ${error.message || "aborted"}`);
        return {
          status: 130,
          interrupted: true,
          completed: false,
          completedAndTerminated: false,
          backend: "sdk",
          tokenStats: null,
          finalResponse: "",
        };
      }
      throw error;
    } finally {
      if (typeof onController === "function") {
        onController(null);
      }
      await closeLogStream(logStream);
    }
  }

  let printed = false;
  let lastActivityAt = Date.now();
  let lastIdleNoticeBucket = 0;
  let hangWarned = false;
  let threadId = "";
  let finalResponse = "";
  let usage = null;
  const items = [];
  let seenEvent = false;

  const onActivity = () => {
    lastActivityAt = Date.now();
    lastIdleNoticeBucket = 0;
    hangWarned = false;
    seenEvent = true;
    if (quietMode) {
      if (!printed) {
        process.stdout.write(`[${formatClockTime(new Date())}] ${label}`);
        printed = true;
      }
      process.stdout.write(".");
    }
  };

  const heartbeat = setInterval(() => {
    if (!quietMode) return;
    const idleSeconds = Math.floor((Date.now() - lastActivityAt) / 1000);
    if (hangWarningSeconds > 0 && idleSeconds >= hangWarningSeconds && !hangWarned) {
      if (!printed) {
        process.stdout.write(`[${formatClockTime(new Date())}] ${label}`);
        printed = true;
      }
      process.stdout.write(` [warning: no new SDK event for ${hangWarningSeconds}s. Press Ctrl+C for retry/kill options.]`);
      hangWarned = true;
    }
    if (idleNoticeSeconds > 0 && idleSeconds >= idleNoticeSeconds) {
      const bucket = Math.floor(idleSeconds / idleNoticeSeconds);
      if (bucket > lastIdleNoticeBucket) {
        if (!printed) {
          process.stdout.write(`[${formatClockTime(new Date())}] ${label}`);
          printed = true;
        }
        process.stdout.write(` [thinking ${bucket * idleNoticeSeconds}s]`);
        lastIdleNoticeBucket = bucket;
      }
    }
  }, heartbeatSeconds * 1000);

  try {
    const codex = new Codex({ env });
    const thread = codex.startThread({
      workingDirectory: rootDir,
      skipGitRepoCheck: true,
      approvalPolicy: "never",
      sandboxMode: "danger-full-access",
      modelReasoningEffort,
      ...(model ? { model } : {}),
    });
    const { events } = await thread.runStreamed(promptText, { signal: controller.signal });
    for await (const event of events) {
      onActivity();
      writeEvent(logStream, event);
      if (event.type === "thread.started") {
        threadId = event.thread_id || thread.id || "";
      } else if (event.type === "item.completed") {
        items.push(event.item);
        if (event.item?.type === "agent_message") {
          finalResponse = event.item.text || finalResponse;
        }
      } else if (event.type === "turn.completed") {
        usage = event.usage || usage;
      } else if (event.type === "turn.failed") {
        throw new Error(event.error?.message || "SDK turn failed");
      } else if (event.type === "error") {
        throw new Error(event.message || "SDK event stream failed");
      }
    }
    threadId = threadId || thread.id || "";
  } catch (error) {
    if (error?.name === "AbortError" || controller.signal.aborted) {
      writeLine(logStream, `sdk interrupted: ${error.message || "aborted"}`);
      const payload = {
        status: 130,
        interrupted: true,
        completed: false,
        completedAndTerminated: false,
        backend: "sdk",
        tokenStats: null,
        finalResponse,
        threadId,
      };
      await closeLogStream(logStream);
      return payload;
    }
    if (!seenEvent) {
      error.allowFallback = error.allowFallback !== false;
      await closeLogStream(logStream);
      throw error;
    }
    writeLine(logStream, `sdk error: ${error && error.stack ? error.stack : String(error)}`);
    const payload = {
      status: 1,
      interrupted: false,
      completed: false,
      completedAndTerminated: false,
      backend: "sdk",
      tokenStats: makeTokenStats(usage),
      finalResponse,
      threadId,
    };
    await closeLogStream(logStream);
    return payload;
  } finally {
    clearInterval(heartbeat);
    if (quietMode && printed) {
      process.stdout.write("\n");
    }
    if (typeof onController === "function") {
      onController(null);
    }
  }

  if (finalResponse) {
    writeLine(logStream, "");
    writeLine(logStream, "final response:");
    writeLine(logStream, finalResponse);
  }
  if (threadId) {
    writeLine(logStream, "");
    writeLine(logStream, `session id: ${threadId}`);
  }
  const tokenStats = makeTokenStats(usage);
  if (tokenStats) {
    writeLine(logStream, "tokens used");
    writeLine(logStream, `${tokenStats.totalTokens}`);
  }

  const payload = {
    status: 0,
    interrupted: false,
    completed: hasStandaloneLine(finalResponse, completeMarker),
    completedAndTerminated: false,
    backend: "sdk",
    threadId,
    finalResponse,
    items,
    tokenStats,
  };
  await closeLogStream(logStream);
  return payload;
}
