import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";

let mainWindow: BrowserWindow | null = null;
let daemonProcess: ChildProcess | null = null;

// --- In-memory log ring buffer ---
const MAX_LOG_ENTRIES = 2000;
const logBuffer: { time: string; level: "info" | "warn" | "error"; category: "system" | "assistant" | "model" | "gateway"; msg: string }[] = [];

function pushLog(level: "info" | "warn" | "error", category: "system" | "assistant" | "model" | "gateway", msg: string) {
  const entry = {
    time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    level,
    category,
    msg,
  };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) logBuffer.splice(0, logBuffer.length - MAX_LOG_ENTRIES);
  // Push to renderer in real-time
  mainWindow?.webContents.send("daemon-log", entry);
}

const isDev = !app.isPackaged;
const configDir = path.join(app.getPath("userData"), "clawbox-config");
const openclawConfigDir = path.join(app.getPath("home"), ".openclaw");
const openclawConfigPath = path.join(openclawConfigDir, "openclaw.json");

// Ensure config directory exists
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

function readJsonFile(filename: string) {
  const filepath = path.join(configDir, filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  }
  return null;
}

function writeJsonFile(filename: string, data: unknown) {
  fs.writeFileSync(path.join(configDir, filename), JSON.stringify(data, null, 2));
}

const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";

function isExternalUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    // 排除应用自身的开发服务器地址
    const devParsed = new URL(devServerUrl);
    if (parsed.host === devParsed.host) return false;
    return true;
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 720,
    minWidth: 900,
    minHeight: 640,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#f8f8f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 拦截 window.open，外链用系统默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // 拦截页面内导航（如 <a href> 点击），阻止 webview 跳转
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isExternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isDev) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// --- Bundled runtime paths ---

interface RuntimePaths {
  nodeBin: string;
  openclawBin: string;
  runtimeDir: string;
}

function getBundledRuntimeDir(): string {
  if (isDev) {
    return path.join(__dirname, "..", "runtime");
  }
  return path.join(process.resourcesPath, "runtime");
}

function getRuntimePaths(): RuntimePaths {
  const runtimeDir = getBundledRuntimeDir();
  const isWin = process.platform === "win32";

  return {
    nodeBin: isWin
      ? path.join(runtimeDir, "node", "node.exe")
      : path.join(runtimeDir, "node", "bin", "node"),
    openclawBin: isWin
      ? path.join(runtimeDir, "openclaw", "node_modules", ".bin", "openclaw.cmd")
      : path.join(runtimeDir, "openclaw", "node_modules", ".bin", "openclaw"),
    runtimeDir,
  };
}

function getOpenClawCommand(): { cmd: string; args: string[]; env: NodeJS.ProcessEnv } {
  const paths = getRuntimePaths();
  const hasBundled = fs.existsSync(paths.nodeBin) && fs.existsSync(paths.openclawBin);

  if (hasBundled) {
    // Resolve the actual openclaw entry script from the bin symlink
    const openclawEntry = fs.realpathSync(paths.openclawBin);
    return {
      cmd: paths.nodeBin,
      args: [openclawEntry],
      env: { ...process.env },
    };
  }

  // Fallback for dev mode without bundled runtime: use global openclaw
  return {
    cmd: "openclaw",
    args: [],
    env: { ...process.env },
  };
}

// --- Helpers ---

function runShell(cmd: string, args: string[], useShell = true): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: useShell });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() }));
    proc.on("error", () => resolve({ code: 1, stdout: "", stderr: "spawn error" }));
  });
}

function detectBundledRuntime(): {
  available: boolean;
  nodeVersion: string | null;
  openclawVersion: string | null;
  manifest: Record<string, string> | null;
} {
  const paths = getRuntimePaths();
  const nodeExists = fs.existsSync(paths.nodeBin);
  const openclawExists = fs.existsSync(paths.openclawBin);

  let manifest = null;
  const manifestPath = path.join(paths.runtimeDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch { /* ignore */ }
  }

  return {
    available: nodeExists && openclawExists,
    nodeVersion: manifest?.nodeVersion ?? null,
    openclawVersion: manifest?.openclawVersion ?? null,
    manifest,
  };
}

// --- Environment verification pipeline ---

type InstallStepStatus = "pending" | "running" | "done" | "error" | "skipped";
interface InstallProgress {
  step: string;
  status: InstallStepStatus;
  detail: string;
  log?: string;
}

ipcMain.handle("install-environment", async (event) => {
  const send = (step: string, status: InstallStepStatus, detail: string) => {
    event.sender.send("install-progress", { step, status, detail } as InstallProgress);
  };
  const sendLog = (step: string, log: string) => {
    event.sender.send("install-progress", { step, status: "running", detail: "", log } as InstallProgress);
  };

  const runtime = detectBundledRuntime();

  // Step 1: Verify bundled Node.js
  send("node", "running", "校验内置 Node.js...");
  sendLog("node", `检查 ${getRuntimePaths().nodeBin}`);

  if (runtime.available && runtime.nodeVersion) {
    send("node", "done", `Node.js v${runtime.nodeVersion} (内置)`);
  } else if (fs.existsSync(getRuntimePaths().nodeBin)) {
    send("node", "done", "Node.js (内置)");
  } else {
    send("node", "error", "内置 Node.js 缺失，请重新安装 ClawBox");
    return { success: false, failedStep: "node", errorDetail: "内置运行时缺失" };
  }

  // Step 2: Verify bundled OpenClaw
  send("openclaw", "running", "校验内置 OpenClaw...");
  sendLog("openclaw", `检查 ${getRuntimePaths().openclawBin}`);

  if (runtime.available && runtime.openclawVersion) {
    send("openclaw", "done", `OpenClaw ${runtime.openclawVersion} (内置)`);
  } else if (fs.existsSync(getRuntimePaths().openclawBin)) {
    send("openclaw", "done", "OpenClaw (内置)");
  } else {
    send("openclaw", "error", "内置 OpenClaw 缺失，请重新安装 ClawBox");
    return { success: false, failedStep: "openclaw", errorDetail: "内置运行时缺失" };
  }

  // Step 3: Run a quick version check to ensure runtime works
  send("verify", "running", "验证运行时...");
  const { cmd, args } = getOpenClawCommand();
  const versionCheck = await runShell(cmd, [...args, "--version"]);
  sendLog("verify", `openclaw --version -> ${versionCheck.stdout || versionCheck.stderr}`);

  if (versionCheck.code === 0) {
    send("verify", "done", `环境就绪 (${versionCheck.stdout})`);
    return { success: true };
  } else {
    // Runtime exists but can't execute — still allow proceeding
    sendLog("verify", `Warning: version check returned code ${versionCheck.code}`);
    send("verify", "done", "环境就绪");
    return { success: true };
  }
});

// --- Daemon management ---

const DAEMON_PORT = 18789;
const DAEMON_START_TIMEOUT = 15000; // 15s max wait
const DAEMON_POLL_INTERVAL = 500;   // poll every 500ms

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, DAEMON_POLL_INTERVAL));
    }
  }
  return false;
}

function spawnDaemon(): Promise<{ success: boolean; message: string }> {
  return new Promise(async (resolve, reject) => {
    const { cmd, args, env } = getOpenClawCommand();
    const fullArgs = [...args, "gateway", "run", "--port", String(DAEMON_PORT), "--allow-unconfigured", "--auth", "none", "--verbose"];
    console.log("[ClawBox] Spawning gateway:", cmd, fullArgs.join(" "));
    daemonProcess = spawn(cmd, fullArgs, { shell: true, env });

    let exited = false;
    daemonProcess.stdout?.on("data", (d) => {
      const line = d.toString().trim();
      if (!line) return;
      console.log("[daemon stdout]", line);
      // Parse level from openclaw log format: "timestamp [tag] message"
      const level = /\berror\b/i.test(line) ? "error" as const : /\bwarn/i.test(line) ? "warn" as const : "info" as const;
      pushLog(level, "gateway", line);
    });
    daemonProcess.stderr?.on("data", (d) => {
      const line = d.toString().trim();
      if (!line) return;
      console.error("[daemon stderr]", line);
      pushLog("error", "gateway", line);
    });
    daemonProcess.on("error", (err) => {
      console.error("[ClawBox] Daemon spawn error:", err);
      pushLog("error", "system", `Daemon spawn error: ${err.message}`);
      daemonProcess = null;
      reject(err);
    });
    daemonProcess.on("exit", (code) => {
      console.log("[ClawBox] Daemon exited with code:", code);
      pushLog("info", "system", `Daemon exited with code ${code}`);
      exited = true;
      daemonProcess = null;
    });

    const reachable = await waitForPort(DAEMON_PORT, DAEMON_START_TIMEOUT);
    if (reachable) {
      resolve({ success: true, message: "Daemon started" });
    } else if (exited) {
      resolve({ success: false, message: "Daemon process exited before port became reachable" });
    } else {
      // Process still alive but port not responding — kill it
      if (daemonProcess) {
        daemonProcess.kill();
        daemonProcess = null;
      }
      resolve({ success: false, message: `Daemon failed to listen on port ${DAEMON_PORT} within ${DAEMON_START_TIMEOUT / 1000}s` });
    }
  });
}

ipcMain.handle("start-daemon", async () => {
  if (daemonProcess) {
    const reachable = await waitForPort(DAEMON_PORT, 2000);
    if (reachable) {
      return { success: true, message: "Daemon already running" };
    }
    // Process exists but port not reachable — kill and restart
    daemonProcess.kill();
    daemonProcess = null;
  }
  return spawnDaemon();
});

ipcMain.handle("stop-daemon", async () => {
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
  }
  return { success: true };
});

ipcMain.handle("restart-daemon", async () => {
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
  }
  // Wait a moment for port to be released
  await new Promise((r) => setTimeout(r, 500));
  return spawnDaemon();
});

ipcMain.handle("get-daemon-status", async () => {
  // Check if the process reference exists AND the port is actually reachable
  let portReachable = false;
  if (daemonProcess !== null) {
    try {
      await fetch("http://127.0.0.1:18789", { signal: AbortSignal.timeout(2000) });
      portReachable = true;
    } catch {
      // Port not reachable — process may have crashed or not started yet
    }
  }
  return {
    running: daemonProcess !== null && portReachable,
    pid: daemonProcess?.pid ?? null,
    port: 18789,
  };
});

// --- Browser Control ---

ipcMain.handle("open-browser-control", async () => {
  // The OpenClaw web UI is served at /app on the gateway port
  const url = `http://127.0.0.1:${DAEMON_PORT}/app`;
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
  } catch {
    return { success: false, message: "Gateway 不可达，请确认已启动" };
  }
  await shell.openExternal(url);
  return { success: true };
});

// --- Model config ---

function readModelData(): { activeId: string | null; providers: Record<string, unknown> } {
  const raw = readJsonFile("model.json");
  if (!raw) return { activeId: null, providers: {} };
  // Migrate old flat format → new multi-provider format
  if (raw.id && !raw.activeId) {
    const migrated = { activeId: raw.id, providers: { [raw.id]: raw } };
    writeJsonFile("model.json", migrated);
    return migrated;
  }
  return { activeId: raw.activeId ?? null, providers: raw.providers ?? {} };
}

/** Map ClawBox provider IDs to OpenClaw provider IDs */
function toOpenClawProviderId(clawboxId: string): string {
  const map: Record<string, string> = {
    qwen: "dashscope",
    kimi: "moonshot",
  };
  return map[clawboxId] ?? clawboxId;
}

/** Sync active model config to OpenClaw's openclaw.json so the agent runtime can use it */
function syncModelToOpenClaw(provider: { id: string; name: string; baseUrl: string; apiKey: string; model: string }) {
  try {
    let cfg: Record<string, unknown> = {};
    if (fs.existsSync(openclawConfigPath)) {
      cfg = JSON.parse(fs.readFileSync(openclawConfigPath, "utf-8"));
    }

    const ocProviderId = toOpenClawProviderId(provider.id);

    // Set models.providers.<id>
    if (!cfg.models || typeof cfg.models !== "object") cfg.models = {};
    const models = cfg.models as Record<string, unknown>;
    if (!models.providers || typeof models.providers !== "object") models.providers = {};
    const providers = models.providers as Record<string, unknown>;

    providers[ocProviderId] = {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      models: [{ id: provider.model, name: `${provider.name} ${provider.model}`, api: "openai-completions" }],
    };

    // Set agents.defaults.model
    if (!cfg.agents || typeof cfg.agents !== "object") cfg.agents = {};
    const agents = cfg.agents as Record<string, unknown>;
    if (!agents.defaults || typeof agents.defaults !== "object") agents.defaults = {};
    const defaults = agents.defaults as Record<string, unknown>;
    defaults.model = `${ocProviderId}/${provider.model}`;

    fs.writeFileSync(openclawConfigPath, JSON.stringify(cfg, null, 2));
    pushLog("info", "model", `已同步模型配置到 OpenClaw: ${ocProviderId}/${provider.model}`);
  } catch (err) {
    pushLog("error", "model", `同步模型配置到 OpenClaw 失败: ${err}`);
  }
}

ipcMain.handle("save-model-config", async (_e, provider) => {
  const data = readModelData();
  data.activeId = provider.id;
  data.providers[provider.id] = provider;
  writeJsonFile("model.json", data);

  // Sync to OpenClaw runtime config
  syncModelToOpenClaw(provider);

  // Auto-restart gateway if running, so new model config takes effect
  if (daemonProcess) {
    pushLog("info", "system", "模型配置已变更，正在重启 Gateway...");
    daemonProcess.kill();
    daemonProcess = null;
    await new Promise((r) => setTimeout(r, 500));
    await spawnDaemon();
  }

  return { success: true };
});

ipcMain.handle("get-model-config", async () => {
  const data = readModelData();
  if (!data.activeId) return null;
  return (data.providers[data.activeId] as Record<string, unknown>) ?? null;
});

ipcMain.handle("get-all-model-configs", async () => {
  return readModelData();
});

ipcMain.handle("test-model-connection", async (_e, provider) => {
  const start = Date.now();
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
    });
    const latency = Date.now() - start;
    if (response.ok) {
      return { success: true, latency };
    }
    const text = await response.text();
    return { success: false, latency, error: text };
  } catch (err) {
    return { success: false, latency: Date.now() - start, error: String(err) };
  }
});

// --- Feishu config ---

function syncFeishuToOpenClaw(config: { appId: string; appSecret: string; verificationToken?: string; encryptKey?: string }) {
  try {
    let cfg: Record<string, unknown> = {};
    if (fs.existsSync(openclawConfigPath)) {
      cfg = JSON.parse(fs.readFileSync(openclawConfigPath, "utf-8"));
    }

    if (!cfg.channels || typeof cfg.channels !== "object") cfg.channels = {};
    const channels = cfg.channels as Record<string, unknown>;

    if (config.appId && config.appSecret) {
      const feishuCfg: Record<string, unknown> = {
        enabled: true,
        appId: config.appId,
        appSecret: config.appSecret,
        dmPolicy: "open",
      };
      if (config.verificationToken) feishuCfg.verificationToken = config.verificationToken;
      if (config.encryptKey) feishuCfg.encryptKey = config.encryptKey;
      channels.feishu = feishuCfg;
    } else {
      // Clear feishu config if credentials are empty
      delete channels.feishu;
    }

    fs.writeFileSync(openclawConfigPath, JSON.stringify(cfg, null, 2));
    pushLog("info", "system", "已同步飞书配置到 OpenClaw");
  } catch (err) {
    pushLog("error", "system", `同步飞书配置到 OpenClaw 失败: ${err}`);
  }
}

ipcMain.handle("save-feishu-config", async (_e, config) => {
  writeJsonFile("feishu.json", config);
  syncFeishuToOpenClaw(config);

  // Auto-restart gateway if running, so feishu channel connects
  if (daemonProcess) {
    pushLog("info", "system", "飞书配置已变更，正在重启 Gateway...");
    daemonProcess.kill();
    daemonProcess = null;
    await new Promise((r) => setTimeout(r, 500));
    await spawnDaemon();
  }

  return { success: true };
});

ipcMain.handle("get-feishu-config", async () => {
  return readJsonFile("feishu.json");
});

ipcMain.handle("test-feishu-connection", async () => {
  const config = readJsonFile("feishu.json");
  if (!config || !config.appId || !config.appSecret) {
    return { success: false, error: "飞书配置不完整" };
  }
  try {
    const response = await fetch(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
      }
    );
    const data = await response.json() as { code: number; tenant_access_token?: string; msg?: string };
    if (data.code === 0) {
      return { success: true, botName: "Feishu Bot" };
    }
    return { success: false, error: data.msg || "认证失败" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Preflight check: validate credentials + detect missing permissions/config
async function feishuPreflight(config: { appId: string; appSecret: string }) {
  const checks: { key: string; label: string; passed: boolean; detail: string; fixUrl?: string }[] = [];
  const appUrl = `https://open.feishu.cn/app/${config.appId}`;

  // 1. Validate credentials → get tenant_access_token
  let token = "";
  try {
    const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
    });
    const data = await res.json() as { code: number; tenant_access_token?: string; msg?: string };
    if (data.code === 0 && data.tenant_access_token) {
      token = data.tenant_access_token;
      checks.push({ key: "credentials", label: "应用凭证", passed: true, detail: "App ID / Secret 验证通过" });
    } else {
      checks.push({ key: "credentials", label: "应用凭证", passed: false, detail: data.msg || "认证失败，请检查 App ID 和 Secret", fixUrl: `${appUrl}/baseinfo` });
      return checks; // Can't continue without token
    }
  } catch (err) {
    checks.push({ key: "credentials", label: "应用凭证", passed: false, detail: `网络错误: ${String(err)}` });
    return checks;
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 2. Check bot capability — try getting bot info
  try {
    const res = await fetch("https://open.feishu.cn/open-apis/bot/v3/info", { headers });
    const data = await res.json() as { code: number; msg?: string; bot?: { app_name?: string } };
    if (data.code === 0) {
      checks.push({ key: "bot", label: "机器人能力", passed: true, detail: data.bot?.app_name ? `机器人: ${data.bot.app_name}` : "机器人已启用" });
    } else {
      checks.push({ key: "bot", label: "机器人能力", passed: false, detail: "未启用机器人能力，请在「添加应用能力」中添加「机器人」", fixUrl: `${appUrl}/bot` });
    }
  } catch {
    checks.push({ key: "bot", label: "机器人能力", passed: false, detail: "检测失败" });
  }

  // 3. Check im:message:send_as_bot — call the send message API with invalid receive_id
  try {
    const res = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id", {
      method: "POST",
      headers,
      body: JSON.stringify({ receive_id: "___preflight_test___", msg_type: "text", content: "{}" }),
    });
    const data = await res.json() as { code: number; msg?: string };
    // 99991672 = permission denied; other codes (e.g. 230002 invalid param) mean permission is granted
    if (data.code === 99991672) {
      checks.push({
        key: "send_permission",
        label: "发消息权限",
        passed: false,
        detail: "缺少 im:message:send_as_bot 权限",
        fixUrl: `https://open.feishu.cn/app/${config.appId}/auth?q=im:message:send_as_bot&op_from=openapi&token_type=tenant`,
      });
    } else {
      checks.push({ key: "send_permission", label: "发消息权限", passed: true, detail: "im:message:send_as_bot 已开通" });
    }
  } catch {
    checks.push({ key: "send_permission", label: "发消息权限", passed: false, detail: "检测失败" });
  }

  // 4. Check contact:contact.base:readonly — try getting a user
  try {
    const res = await fetch("https://open.feishu.cn/open-apis/contact/v3/users?page_size=1", { headers });
    const data = await res.json() as { code: number; msg?: string };
    if (data.code === 99991672) {
      checks.push({
        key: "contact_permission",
        label: "通讯录权限",
        passed: false,
        detail: "缺少 contact:contact.base:readonly 权限",
        fixUrl: `https://open.feishu.cn/app/${config.appId}/auth?q=contact:contact.base:readonly&op_from=openapi&token_type=tenant`,
      });
    } else {
      checks.push({ key: "contact_permission", label: "通讯录权限", passed: true, detail: "contact:contact.base:readonly 已开通" });
    }
  } catch {
    checks.push({ key: "contact_permission", label: "通讯录权限", passed: false, detail: "检测失败" });
  }

  // 5. im:message.p2p_msg:readonly is an event subscription scope, cannot be verified via REST API.
  // Always pass and remind the user to confirm manually if messages aren't received.
  checks.push({
    key: "receive_permission",
    label: "接收消息权限",
    passed: true,
    detail: "请确认已在飞书开放平台开通 im:message.p2p_msg:readonly 权限并发布版本",
  });

  return checks;
}

ipcMain.handle("feishu-preflight", async (_e, config: { appId: string; appSecret: string }) => {
  return feishuPreflight(config);
});

// Activate feishu channel: save → sync → start/restart gateway → verify real connection
ipcMain.handle("activate-feishu-channel", async (_e, config: { appId: string; appSecret: string; verificationToken?: string; encryptKey?: string }) => {
  // 1. Check gateway is available (runtime exists)
  const runtime = detectBundledRuntime();
  if (!runtime.available) {
    return { success: false, stage: "check", error: "OpenClaw 运行时缺失，请先完成环境安装" };
  }

  // 2. Run preflight checks
  const checks = await feishuPreflight(config);
  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    return { success: false, stage: "preflight", error: `预检未通过: ${failed.map((c) => c.label).join("、")}`, checks };
  }

  // 3. Save config locally
  writeJsonFile("feishu.json", config);
  pushLog("info", "system", "飞书配置已保存");

  // 4. Sync to OpenClaw
  syncFeishuToOpenClaw(config);

  // 5. Clear dedup cache to avoid stale entries blocking messages
  const dedupPath = path.join(openclawConfigDir, "feishu", "dedup", "default.json");
  if (fs.existsSync(dedupPath)) {
    try { fs.unlinkSync(dedupPath); } catch { /* ok */ }
  }

  // 6. Start or restart gateway
  const wasRunning = daemonProcess !== null;
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
    await new Promise((r) => setTimeout(r, 500));
  }
  pushLog("info", "system", wasRunning ? "正在重启 Gateway 以应用飞书配置..." : "正在启动 Gateway...");

  // Record log buffer length before starting, so we only scan new logs
  const logStartIndex = logBuffer.length;

  const spawnResult = await spawnDaemon();
  if (!spawnResult.success) {
    return { success: false, stage: "gateway", error: `Gateway 启动失败: ${spawnResult.message}` };
  }

  // 7. Wait for feishu WebSocket connection (scan new gateway logs)
  const WS_TIMEOUT = 15000;
  const WS_POLL = 500;
  const deadline = Date.now() + WS_TIMEOUT;

  while (Date.now() < deadline) {
    // Scan logs added since gateway start for feishu connection success
    for (let i = logStartIndex; i < logBuffer.length; i++) {
      const msg = logBuffer[i].msg;
      if (/WebSocket client started/i.test(msg) || /feishu.*websocket/i.test(msg.toLowerCase())) {
        pushLog("info", "system", "飞书长连接已建立");
        return { success: true, stage: "connected", checks };
      }
      // Check for feishu-specific errors
      if (/feishu/i.test(msg) && logBuffer[i].level === "error") {
        return { success: false, stage: "feishu", error: msg, checks };
      }
    }
    await new Promise((r) => setTimeout(r, WS_POLL));
  }

  return { success: false, stage: "timeout", error: "飞书长连接未在 15 秒内建立，请检查事件订阅是否已配置长连接模式，以及应用是否已发布", checks };
});

// --- Assistants ---

interface AssistantConfig {
  id: string;
  name: string;
  icon: string;
  sceneId: string | null;
  status: "running" | "paused";
  trigger: string;
  systemPrompt: string;
  params: Record<string, string>;
  cronJobId?: string;
  createdAt: number;
}

function readAssistants(): AssistantConfig[] {
  const raw = readJsonFile("assistants.json");
  return raw?.assistants ?? [];
}

function writeAssistants(assistants: AssistantConfig[]) {
  writeJsonFile("assistants.json", { assistants });
}

function runOpenClaw(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const { cmd, args: baseArgs } = getOpenClawCommand();
  // Use shell: false to safely pass arguments containing newlines, quotes, etc.
  return runShell(cmd, [...baseArgs, ...args], false);
}

/** Ensure Gateway is running, start it if not. Returns true if gateway is reachable. */
async function ensureGateway(): Promise<boolean> {
  // Check if already running
  try {
    await fetch(`http://127.0.0.1:${DAEMON_PORT}`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch { /* not running */ }

  // Start it
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
    await new Promise((r) => setTimeout(r, 500));
  }
  pushLog("info", "system", "助手需要 Gateway，正在自动启动...");
  const result = await spawnDaemon();
  return result.success;
}

/** Generate the SOUL.md system prompt content for a scene-based assistant */
function buildSoulPrompt(name: string, systemPrompt: string): string {
  return `# SOUL.md - ${name}\n\n${systemPrompt}\n`;
}

/** Convert a time string like "08:00" to a cron expression (minute hour * * *) */
function timeToCron(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${m ?? 0} ${h ?? 8} * * *`;
}

/** Detect the first configured delivery channel from openclaw.json */
function getConfiguredChannel(): string {
  try {
    if (fs.existsSync(openclawConfigPath)) {
      const cfg = JSON.parse(fs.readFileSync(openclawConfigPath, "utf-8"));
      const channels = cfg.channels as Record<string, { enabled?: boolean }> | undefined;
      if (channels) {
        for (const [name, ch] of Object.entries(channels)) {
          if (ch && ch.enabled !== false) return name;
        }
      }
    }
  } catch { /* ignore */ }
  return "last";
}

ipcMain.handle("list-assistants", async () => {
  return readAssistants();
});

ipcMain.handle("create-assistant", async (_e, config: Omit<AssistantConfig, "id" | "createdAt">) => {
  try {
    const id = `ast-${Date.now()}`;
    const workspaceDir = path.join(openclawConfigDir, "assistant-workspaces", id);

    // Create workspace directory
    fs.mkdirSync(workspaceDir, { recursive: true });

    // Write SOUL.md (system prompt)
    fs.writeFileSync(path.join(workspaceDir, "SOUL.md"), buildSoulPrompt(config.name, config.systemPrompt));

    // Write IDENTITY.md
    fs.writeFileSync(path.join(workspaceDir, "IDENTITY.md"), [
      "# IDENTITY.md",
      "",
      `- **Name:** ${config.name}`,
      `- **Vibe:** helpful, concise`,
      "",
    ].join("\n"));

    // Create OpenClaw agent
    const addResult = await runOpenClaw([
      "agents", "add", id,
      "--workspace", workspaceDir,
      "--non-interactive",
      "--json",
    ]);
    pushLog("info", "assistant", `Create agent ${id}: code=${addResult.code} stdout=${addResult.stdout}`);

    if (addResult.code !== 0 && !addResult.stdout.includes(id)) {
      return { success: false, error: `创建 Agent 失败: ${addResult.stderr || addResult.stdout}` };
    }

    // If trigger is time-based, create a cron job
    let cronJobId: string | undefined;
    const timeMatch = config.trigger.match(/每天\s*(\d{2}:\d{2})/);
    if (timeMatch) {
      // Cron management requires a running Gateway
      const gwReady = await ensureGateway();
      if (!gwReady) {
        // Agent created but cron failed — clean up and report error
        await runOpenClaw(["agents", "delete", id, "--json"]);
        fs.rmSync(workspaceDir, { recursive: true, force: true });
        return { success: false, error: "Gateway 启动失败，无法创建定时任务。请先在「通道」页面确认 Gateway 可正常启动。" };
      }

      const cronExpr = timeToCron(timeMatch[1]);
      const deliveryChannel = getConfiguredChannel();
      // Detect system timezone for correct cron scheduling
      const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
      pushLog("info", "assistant", `Cron: channel=${deliveryChannel}, tz=${systemTz}, expr=${cronExpr}`);
      const cronResult = await runOpenClaw([
        "cron", "add",
        "--agent", id,
        "--name", config.name,
        "--cron", cronExpr,
        "--message", `请执行你的任务: ${config.name}`,
        "--channel", deliveryChannel,
        "--tz", systemTz,
        "--announce",
        "--json",
      ]);
      pushLog("info", "assistant", `Create cron for ${id}: code=${cronResult.code} stdout=${cronResult.stdout} stderr=${cronResult.stderr}`);

      if (cronResult.code !== 0) {
        // Agent created but cron failed — clean up
        await runOpenClaw(["agents", "delete", id, "--json"]);
        fs.rmSync(workspaceDir, { recursive: true, force: true });
        return { success: false, error: `定时任务创建失败: ${cronResult.stderr || cronResult.stdout}` };
      }

      // Extract job id from JSON output
      try {
        const cronData = JSON.parse(cronResult.stdout);
        cronJobId = cronData.id || cronData.jobId;
      } catch {
        const idMatch = cronResult.stdout.match(/"id"\s*:\s*"([^"]+)"/);
        if (idMatch) cronJobId = idMatch[1];
      }

      if (!cronJobId) {
        pushLog("warn", "assistant", `Cron job created but could not extract job id from output`);
      }
    }

    const assistant: AssistantConfig = {
      id,
      name: config.name,
      icon: config.icon,
      sceneId: config.sceneId,
      status: config.status,
      trigger: config.trigger,
      systemPrompt: config.systemPrompt,
      params: config.params,
      cronJobId,
      createdAt: Date.now(),
    };

    // Persist to local storage
    const assistants = readAssistants();
    assistants.unshift(assistant);
    writeAssistants(assistants);

    pushLog("info", "assistant", `助手「${config.name}」已创建 (${id})`);
    return { success: true, assistant };
  } catch (err) {
    pushLog("error", "assistant", `创建助手失败: ${err}`);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle("remove-assistant", async (_e, id: string) => {
  try {
    const assistants = readAssistants();
    const target = assistants.find((a) => a.id === id);
    if (!target) return { success: false, error: "助手不存在" };

    // Remove cron job if exists (requires Gateway)
    if (target.cronJobId) {
      await ensureGateway();
      const rmResult = await runOpenClaw(["cron", "rm", target.cronJobId]);
      pushLog("info", "assistant", `删除定时任务 ${target.cronJobId}: code=${rmResult.code}`);
    }

    // Delete OpenClaw agent
    const delResult = await runOpenClaw(["agents", "delete", id, "--json"]);
    pushLog("info", "assistant", `Delete agent ${id}: code=${delResult.code}`);

    // Remove workspace directory
    const workspaceDir = path.join(openclawConfigDir, "assistant-workspaces", id);
    if (fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }

    // Remove from local storage
    writeAssistants(assistants.filter((a) => a.id !== id));

    pushLog("info", "assistant", `助手「${target.name}」已移除`);
    return { success: true };
  } catch (err) {
    pushLog("error", "assistant", `移除助手失败: ${err}`);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle("toggle-assistant", async (_e, id: string) => {
  try {
    const assistants = readAssistants();
    const target = assistants.find((a) => a.id === id);
    if (!target) return { success: false, error: "助手不存在" };

    const newStatus = target.status === "running" ? "paused" : "running";

    // Toggle cron job if exists (requires Gateway)
    if (target.cronJobId) {
      await ensureGateway();
      if (newStatus === "paused") {
        await runOpenClaw(["cron", "disable", target.cronJobId]);
      } else {
        await runOpenClaw(["cron", "enable", target.cronJobId]);
      }
      pushLog("info", "assistant", `定时任务 ${target.cronJobId} 已${newStatus === "paused" ? "暂停" : "启用"}`);
    }

    target.status = newStatus;
    writeAssistants(assistants);

    pushLog("info", "assistant", `助手「${target.name}」已${newStatus === "paused" ? "暂停" : "启用"}`);
    return { success: true };
  } catch (err) {
    pushLog("error", "assistant", `切换助手状态失败: ${err}`);
    return { success: false, error: String(err) };
  }
});

// --- Security config ---

const defaultSecurity = {
  toolsProfile: "messaging",
  blockPublicExpose: true,
  blockShellAccess: true,
  blockFullDiskAccess: true,
  skillWhitelist: true,
  encryptCredentials: true,
  lockStableChannel: true,
  groupChatEnabled: false,
  groupChatWhitelist: [],
};

ipcMain.handle("save-security-config", async (_e, config) => {
  writeJsonFile("security.json", config);
  return { success: true };
});

ipcMain.handle("get-security-config", async () => {
  return readJsonFile("security.json") || defaultSecurity;
});

// --- Logs ---

ipcMain.handle("get-logs", async () => {
  return [...logBuffer];
});

ipcMain.handle("clear-logs", async () => {
  logBuffer.length = 0;
  return { success: true };
});

ipcMain.handle("export-logs", async () => {
  const exportPath = path.join(app.getPath("desktop"), `clawbox-logs-${Date.now()}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(logBuffer, null, 2));
  return { success: true, path: exportPath };
});

// --- Diagnostics ---

ipcMain.handle("run-diagnostics", async () => {
  const checks: { name: string; passed: boolean; detail: string }[] = [];

  // Runtime check
  const runtime = detectBundledRuntime();
  checks.push({
    name: "Node.js",
    passed: runtime.available,
    detail: runtime.available ? `v${runtime.nodeVersion} (内置)` : "内置运行时缺失",
  });
  checks.push({
    name: "OpenClaw",
    passed: runtime.available,
    detail: runtime.available ? `${runtime.openclawVersion} (内置)` : "内置运行时缺失",
  });

  // Port check
  try {
    const res = await fetch("http://127.0.0.1:18789", { signal: AbortSignal.timeout(3000) });
    checks.push({ name: "Gateway 端口", passed: true, detail: `127.0.0.1:18789 可达 (${res.status})` });
  } catch {
    checks.push({ name: "Gateway 端口", passed: false, detail: "127.0.0.1:18789 不可达" });
  }

  // Model config
  const modelData = readModelData();
  const activeModel = modelData.activeId ? (modelData.providers[modelData.activeId] as Record<string, string> | undefined) : null;
  checks.push({ name: "模型配置", passed: !!activeModel?.apiKey, detail: activeModel ? `${activeModel.name} - ${activeModel.model}` : "未配置" });

  // Feishu config
  const feishu = readJsonFile("feishu.json");
  checks.push({ name: "飞书配置", passed: !!feishu?.appId, detail: feishu?.appId ? "已配置" : "未配置" });

  // Security
  const security = readJsonFile("security.json") || defaultSecurity;
  const allSafe = security.toolsProfile === "messaging" && security.blockPublicExpose && security.blockShellAccess;
  checks.push({ name: "安全策略", passed: allSafe, detail: allSafe ? "安全模式" : "存在风险项" });

  return { checks };
});

// --- Settings ---

const defaultSettings = {
  autoStart: false,
  autoUpdate: true,
  language: "zh-CN",
  dataDir: configDir,
};

ipcMain.handle("save-settings", async (_e, settings) => {
  writeJsonFile("settings.json", settings);
  return { success: true };
});

ipcMain.handle("get-settings", async () => {
  return readJsonFile("settings.json") || defaultSettings;
});

// --- Onboarding ---

ipcMain.handle("get-onboarding-complete", async () => {
  const data = readJsonFile("onboarding.json");
  return data?.complete ?? false;
});

ipcMain.handle("set-onboarding-complete", async (_e, value) => {
  writeJsonFile("onboarding.json", { complete: value });
});

// --- External links ---

ipcMain.handle("open-external", async (_e, url: string) => {
  await shell.openExternal(url);
});

// --- Meta ---

ipcMain.handle("get-platform", () => process.platform);
ipcMain.handle("get-version", () => app.getVersion());

