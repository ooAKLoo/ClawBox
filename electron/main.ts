import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs";

import { setMainWindow, pushLog, getLogBuffer, clearLogBuffer } from "./lib/logger";
import { configDir, readJsonFile, writeJsonFile } from "./lib/config";
import { getRuntimePaths, detectBundledRuntime, runOpenClaw } from "./lib/runtime";
import { DAEMON_PORT, startDaemon, stopDaemon, restartDaemon, getDaemonStatus, killDaemon, gatewayFetch, getGatewayToken, isDaemonRunning } from "./lib/daemon";
import { configureExposureMonitor, isEncryptionAvailable, scanPrompt, scanCommand, syncSecurityToOpenClaw } from "./lib/security";
import { readModelData, saveModelConfig, testModelConnection } from "./lib/model";
import { getUsageStats, setUsageWindow, startUsageWatcher, stopUsageWatcher } from "./lib/usage";
import { saveFeishuConfig, getFeishuConfig, testFeishuConnection, feishuPreflight, activateFeishuChannel } from "./lib/feishu";
import { listSkills, toggleSkill, listPlugins, togglePlugin, getMemoryStatus, readMemoryFile, searchMemory } from "./lib/extensions";
import { initOrbit, checkUpdate, sendFeedback } from "./lib/orbit";

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";

function isExternalUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const devParsed = new URL(devServerUrl);
    if (parsed.host === devParsed.host) return false;
    return true;
  } catch {
    return false;
  }
}

function createWindow() {
  if (!app.isReady()) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

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

  setMainWindow(mainWindow);
  setUsageWindow(mainWindow);
  startUsageWatcher();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

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
    setMainWindow(null);
    setUsageWindow(null);
    stopUsageWatcher();
  });
}

app.whenReady().then(async () => {
  // Configure exposure monitor with daemon state accessor
  configureExposureMonitor({ isDaemonRunning, port: DAEMON_PORT });
  // Initialize Orbit SDK for analytics & update tracking
  await initOrbit();

  // Sync login-item setting from persisted config
  const savedSettings = readJsonFile("settings.json");
  if (savedSettings?.autoStart !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: !!savedSettings.autoStart,
      ...(process.platform === "darwin" ? { openAsHidden: true } : {}),
    });
  }

  createWindow();
});

app.on("window-all-closed", () => {
  killDaemon();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  createWindow();
});

// --- Environment verification ---

type InstallStepStatus = "pending" | "running" | "done" | "error" | "skipped";
interface InstallProgress { step: string; status: InstallStepStatus; detail: string; log?: string }

ipcMain.handle("install-environment", async (event) => {
  const send = (step: string, status: InstallStepStatus, detail: string) => {
    event.sender.send("install-progress", { step, status, detail } as InstallProgress);
  };
  const sendLog = (step: string, log: string) => {
    event.sender.send("install-progress", { step, status: "running", detail: "", log } as InstallProgress);
  };

  const runtime = detectBundledRuntime();

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

  send("verify", "running", "验证运行时...");
  const versionCheck = await runOpenClaw(["--version"]);
  sendLog("verify", `openclaw --version -> ${versionCheck.stdout || versionCheck.stderr}`);

  if (versionCheck.code === 0) {
    send("verify", "done", `环境就绪 (${versionCheck.stdout})`);
  } else {
    const errMsg = versionCheck.stderr || versionCheck.stdout || `exit code ${versionCheck.code}`;
    send("verify", "error", `运行时验证失败: ${errMsg}`);
    return { success: false, failedStep: "verify", errorDetail: `openclaw --version 失败: ${errMsg}` };
  }
  // Wait for the progress event to reach the renderer before resolving the invoke promise,
  // otherwise installDone fires before the verify step UI updates.
  await new Promise((r) => setTimeout(r, 80));
  return { success: true };
});

// --- Daemon IPC ---

ipcMain.handle("start-daemon", () => startDaemon());
ipcMain.handle("stop-daemon", () => stopDaemon());
ipcMain.handle("restart-daemon", () => restartDaemon());
ipcMain.handle("get-daemon-status", () => getDaemonStatus());

ipcMain.handle("open-browser-control", async () => {
  const baseUrl = `http://127.0.0.1:${DAEMON_PORT}/app`;
  try {
    await gatewayFetch(baseUrl, { signal: AbortSignal.timeout(2000) });
  } catch {
    return { success: false, message: "Gateway 不可达，请确认已启动" };
  }
  const token = getGatewayToken();
  const url = token
    ? `${baseUrl}?token=${encodeURIComponent(token)}`
    : baseUrl;
  await shell.openExternal(url);
  return { success: true };
});

// --- Model IPC ---

ipcMain.handle("save-model-config", (_e, provider) => saveModelConfig(provider));
ipcMain.handle("get-model-config", async () => {
  const data = readModelData();
  if (!data.activeId) return null;
  return (data.providers[data.activeId] as Record<string, unknown>) ?? null;
});
ipcMain.handle("get-all-model-configs", () => readModelData());
ipcMain.handle("test-model-connection", (_e, provider) => testModelConnection(provider));
ipcMain.handle("get-usage-stats", () => getUsageStats());

// --- Feishu IPC ---

ipcMain.handle("save-feishu-config", (_e, config) => saveFeishuConfig(config));
ipcMain.handle("get-feishu-config", () => getFeishuConfig());
ipcMain.handle("test-feishu-connection", () => testFeishuConnection());
ipcMain.handle("feishu-preflight", (_e, config) => feishuPreflight(config));
ipcMain.handle("activate-feishu-channel", (_e, config) => activateFeishuChannel(config));

// --- Extensions IPC ---

ipcMain.handle("list-skills", () => listSkills());
ipcMain.handle("toggle-skill", (_e, name: string, enable: boolean) => toggleSkill(name, enable));
ipcMain.handle("list-plugins", () => listPlugins());
ipcMain.handle("toggle-plugin", (_e, id: string, enable: boolean) => togglePlugin(id, enable));
ipcMain.handle("get-memory-status", () => getMemoryStatus());
ipcMain.handle("read-memory-file", (_e, filePath: string) => readMemoryFile(filePath));
ipcMain.handle("search-memory", (_e, query: string) => searchMemory(query));

// --- Security IPC ---

const defaultSecurity = {
  blockPublicExpose: true,
  blockShellAccess: true,
  blockDangerousCommands: true,
  blockFullDiskAccess: true,
  encryptCredentials: true,
  groupChatEnabled: false,
  groupChatWhitelist: [],
  promptScanEnabled: true,
};

ipcMain.handle("save-security-config", async (_e, config) => {
  const prevConfig = readJsonFile("security.json") || defaultSecurity;
  writeJsonFile("security.json", config);

  // Sync security policies to OpenClaw config
  syncSecurityToOpenClaw(config);

  // Restart daemon if network or runtime policies changed (requires rebind / reload)
  const needsRestart =
    prevConfig.blockPublicExpose !== config.blockPublicExpose ||
    prevConfig.blockShellAccess !== config.blockShellAccess ||
    prevConfig.blockDangerousCommands !== config.blockDangerousCommands ||
    prevConfig.blockFullDiskAccess !== config.blockFullDiskAccess ||
    prevConfig.groupChatEnabled !== config.groupChatEnabled ||
    JSON.stringify(prevConfig.groupChatWhitelist) !== JSON.stringify(config.groupChatWhitelist);

  if (needsRestart && isDaemonRunning()) {
    pushLog("info", "system", "安全策略已变更，正在重启 Gateway...");
    await restartDaemon();
  }

  return { success: true };
});
ipcMain.handle("get-security-config", () => readJsonFile("security.json") || defaultSecurity);

ipcMain.handle("scan-prompt", (_e, text: string) => scanPrompt(text));
ipcMain.handle("scan-command", (_e, cmd: string) => scanCommand(cmd));
ipcMain.handle("dismiss-security-alert", (_e, alertId: string) => {
  pushLog("info", "system", `安全告警已忽略: ${alertId}`);
  return { success: true };
});

// --- Logs IPC ---

ipcMain.handle("get-logs", () => [...getLogBuffer()]);
ipcMain.handle("clear-logs", () => { clearLogBuffer(); return { success: true }; });
ipcMain.handle("export-logs", () => {
  const exportPath = path.join(app.getPath("desktop"), `clawbox-logs-${Date.now()}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(getLogBuffer(), null, 2));
  return { success: true, path: exportPath };
});

// --- Diagnostics IPC ---

ipcMain.handle("run-diagnostics", async () => {
  const checks: { name: string; passed: boolean; detail: string }[] = [];

  const runtime = detectBundledRuntime();
  checks.push({ name: "Node.js", passed: runtime.available, detail: runtime.available ? `v${runtime.nodeVersion} (内置)` : "内置运行时缺失" });
  checks.push({ name: "OpenClaw", passed: runtime.available, detail: runtime.available ? `${runtime.openclawVersion} (内置)` : "内置运行时缺失" });

  try {
    const res = await gatewayFetch("http://127.0.0.1:18789", { signal: AbortSignal.timeout(3000) });
    checks.push({ name: "Gateway 端口", passed: true, detail: `127.0.0.1:18789 可达 (${res.status})` });
  } catch {
    checks.push({ name: "Gateway 端口", passed: false, detail: "127.0.0.1:18789 不可达" });
  }

  const modelData = readModelData();
  const activeModel = modelData.activeId ? (modelData.providers[modelData.activeId] as Record<string, string> | undefined) : null;
  checks.push({ name: "模型配置", passed: !!activeModel?.apiKey, detail: activeModel ? `${activeModel.name} - ${activeModel.model}` : "未配置" });

  const feishu = readJsonFile("feishu.json");
  checks.push({ name: "飞书配置", passed: !!feishu?.appId, detail: feishu?.appId ? "已配置" : "未配置" });

  const security = readJsonFile("security.json") || defaultSecurity;
  const allSafe = security.blockPublicExpose && security.blockShellAccess && security.blockDangerousCommands && security.blockFullDiskAccess;
  checks.push({ name: "安全策略", passed: allSafe, detail: allSafe ? "安全模式" : "存在风险项" });

  const token = getGatewayToken();
  checks.push({ name: "Gateway 认证", passed: !!token, detail: token ? "Token 认证已启用" : "未启动" });

  const encAvail = isEncryptionAvailable();
  checks.push({ name: "凭证加密", passed: encAvail, detail: encAvail ? "系统钥匙串可用" : "系统钥匙串不可用，凭证未加密" });

  return { checks };
});

// --- Settings IPC ---

const defaultSettings = { autoStart: false, autoUpdate: true, language: "zh-CN", dataDir: configDir };

ipcMain.handle("save-settings", (_e, settings) => {
  writeJsonFile("settings.json", settings);

  // Apply auto-start (login item) setting
  app.setLoginItemSettings({
    openAtLogin: !!settings.autoStart,
    ...(process.platform === "darwin" ? { openAsHidden: true } : {}),
  });

  return { success: true };
});
ipcMain.handle("get-settings", () => readJsonFile("settings.json") || defaultSettings);

// --- Onboarding IPC ---

ipcMain.handle("get-onboarding-complete", () => { const data = readJsonFile("onboarding.json"); return data?.complete ?? false; });
ipcMain.handle("set-onboarding-complete", (_e, value) => { writeJsonFile("onboarding.json", { complete: value }); });

// --- External links ---

ipcMain.handle("open-external", (_e, url: string) => shell.openExternal(url));

// --- Orbit (Analytics / Update / Feedback) ---

ipcMain.handle("check-update", () => checkUpdate());
ipcMain.handle("send-feedback", (_e, data: { content: string; contact?: string }) => sendFeedback(data));

// --- Meta ---

ipcMain.handle("get-platform", () => process.platform);
ipcMain.handle("get-version", () => app.getVersion());
