const VALID_BACKENDS = new Set(["auto", "sdk", "cli"]);

function normalizeBackend(value) {
  const normalized = String(value || "auto").trim().toLowerCase();
  return VALID_BACKENDS.has(normalized) ? normalized : "auto";
}

async function checkCodexSdkAvailability(env = process.env) {
  if (env.RALPH_TEST_CODEX_SDK_UNAVAILABLE === "1") {
    return {
      available: false,
      detail: "forced unavailable for test",
    };
  }
  try {
    await import("@openai/codex-sdk");
    return {
      available: true,
      detail: "@openai/codex-sdk available",
    };
  } catch (error) {
    return {
      available: false,
      detail: error && error.message ? error.message : String(error),
    };
  }
}

async function resolveCodexBackend(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const requested = normalizeBackend(options.requested || env.RALPH_CODEX_BACKEND);
  const agentKind = String(options.agentKind || env.RALPH_AGENT_KIND || "").trim().toLowerCase();
  const commandSource = String(options.commandSource || env.RALPH_AGENT_COMMAND_SOURCE || "").trim().toLowerCase();
  const sdk = await checkCodexSdkAvailability(env);

  if (requested === "cli") {
    return {
      requested,
      selected: "cli",
      sdkAvailable: sdk.available,
      sdkDetail: sdk.detail,
      fallbackReason: "forced by RALPH_CODEX_BACKEND=cli",
    };
  }

  if (agentKind !== "codex") {
    return {
      requested,
      selected: "cli",
      sdkAvailable: sdk.available,
      sdkDetail: sdk.detail,
      fallbackReason: "SDK backend is only enabled for Codex agents",
    };
  }

  if (platform !== "win32") {
    return {
      requested,
      selected: "cli",
      sdkAvailable: sdk.available,
      sdkDetail: sdk.detail,
      fallbackReason: "SDK backend is only enabled on Windows for sdk01",
    };
  }

  if (commandSource === "env") {
    return {
      requested,
      selected: "cli",
      sdkAvailable: sdk.available,
      sdkDetail: sdk.detail,
      fallbackReason: "custom AGENT_CMD override forces legacy CLI path",
    };
  }

  if (!sdk.available) {
    if (requested === "sdk") {
      return {
        requested,
        selected: "sdk",
        sdkAvailable: false,
        sdkDetail: sdk.detail,
        error: `RALPH_CODEX_BACKEND=sdk requested, but @openai/codex-sdk is unavailable: ${sdk.detail}`,
        fallbackReason: "",
      };
    }
    return {
      requested,
      selected: "cli",
      sdkAvailable: false,
      sdkDetail: sdk.detail,
      fallbackReason: `@openai/codex-sdk unavailable: ${sdk.detail}`,
    };
  }

  return {
    requested,
    selected: "sdk",
    sdkAvailable: true,
    sdkDetail: sdk.detail,
    fallbackReason: "",
  };
}

module.exports = {
  checkCodexSdkAvailability,
  normalizeBackend,
  resolveCodexBackend,
};
