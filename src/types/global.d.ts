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
  port: number;
}

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  category: "system" | "assistant" | "model" | "gateway";
  msg: string;
}

export type InstallStepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface InstallProgress {
  step: string;
  status: InstallStepStatus;
  detail: string;
  log?: string;
}

interface ClawBoxAPI {
  installEnvironment: () => Promise<{ success: boolean; failedStep?: string; errorDetail?: string }>;
  onInstallProgress: (callback: (progress: InstallProgress) => void) => () => void;
  startDaemon: () => Promise<{ success: boolean; message: string }>;
  stopDaemon: () => Promise<{ success: boolean }>;
  restartDaemon: () => Promise<{ success: boolean }>;
  getDaemonStatus: () => Promise<DaemonStatus>;
  openBrowserControl: () => Promise<{ success: boolean; message?: string }>;
  getPlatform: () => Promise<string>;
  testModelConnection: (provider: ModelProvider) => Promise<{ success: boolean; latency: number; error?: string }>;
  saveModelConfig: (provider: ModelProvider) => Promise<{ success: boolean }>;
  getModelConfig: () => Promise<ModelProvider | null>;
  getAllModelConfigs: () => Promise<{ activeId: string | null; providers: Record<string, ModelProvider> }>;
  saveFeishuConfig: (config: FeishuConfig) => Promise<{ success: boolean }>;
  getFeishuConfig: () => Promise<FeishuConfig | null>;
  testFeishuConnection: () => Promise<{ success: boolean; botName?: string; error?: string }>;
  saveSecurityConfig: (config: SecurityConfig) => Promise<{ success: boolean }>;
  getSecurityConfig: () => Promise<SecurityConfig>;
  getLogs: () => Promise<LogEntry[]>;
  onDaemonLog: (callback: (entry: LogEntry) => void) => () => void;
  clearLogs: () => Promise<{ success: boolean }>;
  exportLogs: () => Promise<{ success: boolean; path: string }>;
  runDiagnostics: () => Promise<{ checks: { name: string; passed: boolean; detail: string }[] }>;
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>;
  getSettings: () => Promise<AppSettings>;
  getOnboardingComplete: () => Promise<boolean>;
  setOnboardingComplete: (value: boolean) => Promise<void>;
  getVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    clawbox: ClawBoxAPI;
  }
}

export {};
