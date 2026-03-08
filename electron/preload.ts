import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("clawbox", {
  // System
  installEnvironment: () => ipcRenderer.invoke("install-environment"),
  onInstallProgress: (callback: (progress: { step: string; status: string; detail: string }) => void) => {
    const handler = (_event: unknown, progress: { step: string; status: string; detail: string }) => callback(progress);
    ipcRenderer.on("install-progress", handler);
    return () => { ipcRenderer.removeListener("install-progress", handler); };
  },
  getPlatform: () => ipcRenderer.invoke("get-platform"),
  getVersion: () => ipcRenderer.invoke("get-version"),

  // Daemon
  startDaemon: () => ipcRenderer.invoke("start-daemon"),
  stopDaemon: () => ipcRenderer.invoke("stop-daemon"),
  restartDaemon: () => ipcRenderer.invoke("restart-daemon"),
  getDaemonStatus: () => ipcRenderer.invoke("get-daemon-status"),

  openBrowserControl: () => ipcRenderer.invoke("open-browser-control"),

  // Model
  testModelConnection: (provider: unknown) => ipcRenderer.invoke("test-model-connection", provider),
  saveModelConfig: (provider: unknown) => ipcRenderer.invoke("save-model-config", provider),
  getModelConfig: () => ipcRenderer.invoke("get-model-config"),
  getAllModelConfigs: () => ipcRenderer.invoke("get-all-model-configs"),
  getUsageStats: () => ipcRenderer.invoke("get-usage-stats"),

  // Feishu
  saveFeishuConfig: (config: unknown) => ipcRenderer.invoke("save-feishu-config", config),
  getFeishuConfig: () => ipcRenderer.invoke("get-feishu-config"),
  testFeishuConnection: () => ipcRenderer.invoke("test-feishu-connection"),
  activateFeishuChannel: (config: unknown) => ipcRenderer.invoke("activate-feishu-channel", config),
  feishuPreflight: (config: unknown) => ipcRenderer.invoke("feishu-preflight", config),

  // Security
  saveSecurityConfig: (config: unknown) => ipcRenderer.invoke("save-security-config", config),
  getSecurityConfig: () => ipcRenderer.invoke("get-security-config"),

  // Logs
  getLogs: () => ipcRenderer.invoke("get-logs"),
  clearLogs: () => ipcRenderer.invoke("clear-logs"),
  exportLogs: () => ipcRenderer.invoke("export-logs"),
  onDaemonLog: (callback: (entry: { time: string; level: string; category: string; msg: string }) => void) => {
    const handler = (_event: unknown, entry: { time: string; level: string; category: string; msg: string }) => callback(entry);
    ipcRenderer.on("daemon-log", handler);
    return () => { ipcRenderer.removeListener("daemon-log", handler); };
  },

  // Diagnostics
  runDiagnostics: () => ipcRenderer.invoke("run-diagnostics"),

  // Settings
  saveSettings: (settings: unknown) => ipcRenderer.invoke("save-settings", settings),
  getSettings: () => ipcRenderer.invoke("get-settings"),

  // Onboarding
  getOnboardingComplete: () => ipcRenderer.invoke("get-onboarding-complete"),
  setOnboardingComplete: (value: boolean) => ipcRenderer.invoke("set-onboarding-complete", value),

  // Orbit (Update / Feedback)
  checkUpdate: () => ipcRenderer.invoke("check-update"),
  sendFeedback: (data: { content: string; contact?: string }) => ipcRenderer.invoke("send-feedback", data),

  // External links
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),

  // Assistants
  listAssistants: () => ipcRenderer.invoke("list-assistants"),
  createAssistant: (config: unknown) => ipcRenderer.invoke("create-assistant", config),
  removeAssistant: (id: string) => ipcRenderer.invoke("remove-assistant", id),
  toggleAssistant: (id: string) => ipcRenderer.invoke("toggle-assistant", id),

  // Extensions (Skills & Plugins)
  listSkills: () => ipcRenderer.invoke("list-skills"),
  toggleSkill: (name: string, enable: boolean) => ipcRenderer.invoke("toggle-skill", name, enable),
  listPlugins: () => ipcRenderer.invoke("list-plugins"),
  togglePlugin: (id: string, enable: boolean) => ipcRenderer.invoke("toggle-plugin", id, enable),

  // Memory
  getMemoryStatus: () => ipcRenderer.invoke("get-memory-status"),
  readMemoryFile: (filePath: string) => ipcRenderer.invoke("read-memory-file", filePath),
  searchMemory: (query: string) => ipcRenderer.invoke("search-memory", query),

  // Security alerts
  onSecurityAlert: (callback: (alert: { id: string; level: string; title: string; detail: string; action?: string }) => void) => {
    const handler = (_event: unknown, alert: { id: string; level: string; title: string; detail: string; action?: string }) => callback(alert);
    ipcRenderer.on("security-alert", handler);
    return () => { ipcRenderer.removeListener("security-alert", handler); };
  },
  dismissSecurityAlert: (alertId: string) => ipcRenderer.invoke("dismiss-security-alert", alertId),
  scanPrompt: (text: string) => ipcRenderer.invoke("scan-prompt", text),
});
