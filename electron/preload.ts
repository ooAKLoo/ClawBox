import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("clawbox", {
  // System
  checkNode: () => ipcRenderer.invoke("check-node"),
  checkOpenClaw: () => ipcRenderer.invoke("check-openclaw"),
  installOpenClaw: () => ipcRenderer.invoke("install-openclaw"),
  installEnvironment: () => ipcRenderer.invoke("install-environment"),
  onInstallProgress: (callback: (progress: { step: string; status: string; detail: string }) => void) => {
    const handler = (_event: unknown, progress: { step: string; status: string; detail: string }) => callback(progress);
    ipcRenderer.on("install-progress", handler);
    return () => { ipcRenderer.removeListener("install-progress", handler); };
  },
  getPlatform: () => ipcRenderer.invoke("get-platform"),
  getVersion: () => ipcRenderer.invoke("get-version"),
  checkUpdate: () => ipcRenderer.invoke("check-update"),

  // Daemon
  startDaemon: () => ipcRenderer.invoke("start-daemon"),
  stopDaemon: () => ipcRenderer.invoke("stop-daemon"),
  restartDaemon: () => ipcRenderer.invoke("restart-daemon"),
  getDaemonStatus: () => ipcRenderer.invoke("get-daemon-status"),

  // Model
  testModelConnection: (provider: unknown) => ipcRenderer.invoke("test-model-connection", provider),
  saveModelConfig: (provider: unknown) => ipcRenderer.invoke("save-model-config", provider),
  getModelConfig: () => ipcRenderer.invoke("get-model-config"),

  // Feishu
  saveFeishuConfig: (config: unknown) => ipcRenderer.invoke("save-feishu-config", config),
  getFeishuConfig: () => ipcRenderer.invoke("get-feishu-config"),
  testFeishuConnection: () => ipcRenderer.invoke("test-feishu-connection"),
  sendTestMessage: (message: string) => ipcRenderer.invoke("send-test-message", message),

  // Security
  saveSecurityConfig: (config: unknown) => ipcRenderer.invoke("save-security-config", config),
  getSecurityConfig: () => ipcRenderer.invoke("get-security-config"),

  // Logs
  getLogs: (filter?: string) => ipcRenderer.invoke("get-logs", filter),
  clearLogs: () => ipcRenderer.invoke("clear-logs"),
  exportLogs: () => ipcRenderer.invoke("export-logs"),

  // Diagnostics
  runDiagnostics: () => ipcRenderer.invoke("run-diagnostics"),

  // Settings
  saveSettings: (settings: unknown) => ipcRenderer.invoke("save-settings", settings),
  getSettings: () => ipcRenderer.invoke("get-settings"),

  // Onboarding
  getOnboardingComplete: () => ipcRenderer.invoke("get-onboarding-complete"),
  setOnboardingComplete: (value: boolean) => ipcRenderer.invoke("set-onboarding-complete", value),

  // External links
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
});
