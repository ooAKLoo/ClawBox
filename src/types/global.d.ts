export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ModelUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
}

export interface UsageStats {
  byProvider: Record<string, {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requests: number;
    models: Record<string, ModelUsage>;
  }>;
  total: { inputTokens: number; outputTokens: number; totalTokens: number; requests: number };
}

export interface FeishuPreflightCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  fixUrl?: string;
}

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  verificationToken: string;
  encryptKey: string;
}

export interface SecurityConfig {
  blockPublicExpose: boolean;
  blockShellAccess: boolean;
  blockFullDiskAccess: boolean;
  encryptCredentials: boolean;
  groupChatEnabled: boolean;
  groupChatWhitelist: string[];
  promptScanEnabled: boolean;
}

export interface SkillInstaller {
  id: string;
  kind: string;
  label: string;
  command: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  emoji: string;
  homepage: string;
  os: string[];
  requires: { bins: string[]; env: string[] };
  install: SkillInstaller[];
  eligible: boolean;
  enabled: boolean;
}

export interface PluginInfo {
  id: string;
  name: string;
  kind: string;
  channels: string[];
  enabled: boolean;
  hasConfig: boolean;
  configFields: string[];
}

export interface MemoryStatus {
  available: boolean;
  backend: string;
  files: { path: string; size: number; mtime: number }[];
  error?: string;
}

export interface MemorySearchResult {
  snippet: string;
  path: string;
  score: number;
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
  category: "system" | "model" | "gateway";
  msg: string;
}

export interface SecurityAlert {
  id: string;
  level: "warn" | "error";
  title: string;
  detail: string;
  action?: string;
}

export interface UpdateResult {
  hasUpdate: boolean;
  latestVersion?: string;
  releaseNotes?: string;
  forceUpdate?: boolean;
  downloadUrl?: string;
  currentVersion: string;
}

export interface PromptScanResult {
  level: "safe" | "low" | "medium" | "high";
  matched: string[];
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
  getUsageStats: () => Promise<UsageStats>;
  onUsageUpdated: (callback: (stats: UsageStats) => void) => () => void;
  saveFeishuConfig: (config: FeishuConfig) => Promise<{ success: boolean }>;
  getFeishuConfig: () => Promise<FeishuConfig | null>;
  testFeishuConnection: () => Promise<{ success: boolean; botName?: string; error?: string }>;
  activateFeishuChannel: (config: FeishuConfig) => Promise<{ success: boolean; stage: string; error?: string; checks?: FeishuPreflightCheck[] }>;
  feishuPreflight: (config: { appId: string; appSecret: string }) => Promise<FeishuPreflightCheck[]>;
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

  // Extensions (Skills & Plugins)
  listSkills: () => Promise<SkillInfo[]>;
  toggleSkill: (name: string, enable: boolean) => Promise<{ success: boolean; error?: string }>;
  listPlugins: () => Promise<PluginInfo[]>;
  togglePlugin: (id: string, enable: boolean) => Promise<{ success: boolean; error?: string }>;

  // Memory
  getMemoryStatus: () => Promise<MemoryStatus>;
  readMemoryFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  searchMemory: (query: string) => Promise<{ success: boolean; results?: MemorySearchResult[]; error?: string }>;

  // Orbit (Update / Feedback)
  checkUpdate: () => Promise<UpdateResult>;
  sendFeedback: (data: { content: string; contact?: string }) => Promise<{ success: boolean; error?: string }>;

  // Security alerts
  onSecurityAlert: (callback: (alert: SecurityAlert) => void) => () => void;
  dismissSecurityAlert: (alertId: string) => Promise<{ success: boolean }>;
  scanPrompt: (text: string) => Promise<PromptScanResult>;
}

declare global {
  interface Window {
    clawbox: ClawBoxAPI;
  }
}

export {};
