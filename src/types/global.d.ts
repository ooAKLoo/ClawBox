export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  verificationToken: string;
  encryptKey: string;
}

export interface SecurityConfig {
  toolsProfile: "messaging" | "coding" | "full";
  blockPublicExpose: boolean;
  blockShellAccess: boolean;
  blockFullDiskAccess: boolean;
  skillWhitelist: boolean;
  encryptCredentials: boolean;
  lockStableChannel: boolean;
  groupChatEnabled: boolean;
  groupChatWhitelist: string[];
}

export interface AppSettings {
  autoStart: boolean;
  autoUpdate: boolean;
  language: string;
  dataDir: string;
}

export interface DaemonStatus {
  running: boolean;
  pid: number | null;
  uptime: string | null;
  port: number;
}

export interface FeishuStatus {
  connected: boolean;
  botName: string | null;
  lastMessage: string | null;
}

export interface ModelStatus {
  available: boolean;
  provider: string | null;
  model: string | null;
  latency: number | null;
}

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  category: "system" | "feishu" | "model" | "gateway";
  msg: string;
}

interface ClawBoxAPI {
  checkNode: () => Promise<{ installed: boolean; version: string | null }>;
  checkOpenClaw: () => Promise<{ installed: boolean; version: string | null }>;
  installOpenClaw: () => Promise<{ success: boolean; output: string }>;
  startDaemon: () => Promise<{ success: boolean; message: string }>;
  stopDaemon: () => Promise<{ success: boolean }>;
  restartDaemon: () => Promise<{ success: boolean }>;
  getDaemonStatus: () => Promise<DaemonStatus>;
  getPlatform: () => Promise<string>;
  testModelConnection: (provider: ModelProvider) => Promise<{ success: boolean; latency: number; error?: string }>;
  saveModelConfig: (provider: ModelProvider) => Promise<{ success: boolean }>;
  getModelConfig: () => Promise<ModelProvider | null>;
  saveFeishuConfig: (config: FeishuConfig) => Promise<{ success: boolean }>;
  getFeishuConfig: () => Promise<FeishuConfig | null>;
  testFeishuConnection: () => Promise<{ success: boolean; botName?: string; error?: string }>;
  sendTestMessage: (message: string) => Promise<{ success: boolean; error?: string }>;
  saveSecurityConfig: (config: SecurityConfig) => Promise<{ success: boolean }>;
  getSecurityConfig: () => Promise<SecurityConfig>;
  getLogs: (filter?: string) => Promise<LogEntry[]>;
  clearLogs: () => Promise<{ success: boolean }>;
  exportLogs: () => Promise<{ success: boolean; path: string }>;
  runDiagnostics: () => Promise<{ checks: { name: string; passed: boolean; detail: string }[] }>;
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>;
  getSettings: () => Promise<AppSettings>;
  getOnboardingComplete: () => Promise<boolean>;
  setOnboardingComplete: (value: boolean) => Promise<void>;
  checkUpdate: () => Promise<{ hasUpdate: boolean; version?: string }>;
  getVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    clawbox: ClawBoxAPI;
  }
}

export {};
