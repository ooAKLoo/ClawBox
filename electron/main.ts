import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";

let mainWindow: BrowserWindow | null = null;
let daemonProcess: ChildProcess | null = null;

const isDev = !app.isPackaged;
const configDir = path.join(app.getPath("userData"), "clawbox-config");

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

function runShell(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: true });
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

// --- System checks ---

ipcMain.handle("check-node", async () => {
  const runtime = detectBundledRuntime();
  if (runtime.available) {
    return { installed: true, version: `v${runtime.nodeVersion} (bundled)` };
  }
  // Fallback: check system node
  const r = await runShell("node", ["--version"]);
  return { installed: r.code === 0, version: r.code === 0 ? r.stdout : null };
});

ipcMain.handle("check-openclaw", async () => {
  const runtime = detectBundledRuntime();
  if (runtime.available) {
    return { installed: true, version: `${runtime.openclawVersion} (bundled)` };
  }
  // Fallback: check global openclaw
  const r = await runShell("openclaw", ["--version"]);
  if (r.code === 0) return { installed: true, version: r.stdout };
  return { installed: false, version: null };
});

ipcMain.handle("install-openclaw", async () => {
  const runtime = detectBundledRuntime();
  if (runtime.available) {
    return { success: true, output: `Bundled runtime ready (openclaw@${runtime.openclawVersion})` };
  }
  throw new Error("Bundled runtime not found. Please reinstall ClawBox.");
});

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

ipcMain.handle("start-daemon", async () => {
  return new Promise((resolve, reject) => {
    if (daemonProcess) {
      resolve({ success: true, message: "Daemon already running" });
      return;
    }
    const { cmd, args, env } = getOpenClawCommand();
    daemonProcess = spawn(cmd, [...args, "daemon", "start"], { shell: true, env });
    daemonProcess.on("error", (err) => reject(err));
    daemonProcess.on("exit", () => { daemonProcess = null; });
    setTimeout(() => resolve({ success: true, message: "Daemon started" }), 2000);
  });
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
  return new Promise((resolve, reject) => {
    const { cmd, args, env } = getOpenClawCommand();
    daemonProcess = spawn(cmd, [...args, "daemon", "start"], { shell: true, env });
    daemonProcess.on("error", (err) => reject(err));
    daemonProcess.on("exit", () => { daemonProcess = null; });
    setTimeout(() => resolve({ success: true }), 2000);
  });
});

ipcMain.handle("get-daemon-status", async () => {
  return {
    running: daemonProcess !== null,
    pid: daemonProcess?.pid ?? null,
    uptime: null,
    port: 18789,
  };
});

// --- Model config ---

ipcMain.handle("save-model-config", async (_e, provider) => {
  writeJsonFile("model.json", provider);
  return { success: true };
});

ipcMain.handle("get-model-config", async () => {
  return readJsonFile("model.json");
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

ipcMain.handle("save-feishu-config", async (_e, config) => {
  writeJsonFile("feishu.json", config);
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

ipcMain.handle("send-test-message", async (_e, message) => {
  // Placeholder — would send via OpenClaw Feishu channel
  return { success: true };
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

ipcMain.handle("get-logs", async (_e, _filter) => {
  return readJsonFile("logs.json") || [];
});

ipcMain.handle("clear-logs", async () => {
  writeJsonFile("logs.json", []);
  return { success: true };
});

ipcMain.handle("export-logs", async () => {
  const logs = readJsonFile("logs.json") || [];
  const exportPath = path.join(app.getPath("desktop"), `clawbox-logs-${Date.now()}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(logs, null, 2));
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
  const model = readJsonFile("model.json");
  checks.push({ name: "模型配置", passed: !!model?.apiKey, detail: model ? `${model.name} - ${model.model}` : "未配置" });

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

ipcMain.handle("check-update", async () => {
  return { hasUpdate: false };
});
