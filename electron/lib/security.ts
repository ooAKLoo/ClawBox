import { safeStorage } from "electron";
import { app } from "electron";
import { networkInterfaces } from "os";
import path from "path";
import fs from "fs";
import { pushLog, pushSecurityAlert } from "./logger";

// Inline config paths to avoid circular dependency (config.ts imports from security.ts)
const getConfigDir = () => path.join(app.getPath("userData"), "clawbox-config");
const getOpenclawConfigDir = () => path.join(app.getPath("home"), ".openclaw");
const getOpenclawConfigPath = () => path.join(getOpenclawConfigDir(), "openclaw.json");

// --- Credential encryption via Electron safeStorage ---

const ENC_PREFIX = "enc:";

export function encryptValue(plain: string): string {
  if (!plain || !safeStorage.isEncryptionAvailable()) return plain;
  const buf = safeStorage.encryptString(plain);
  return ENC_PREFIX + buf.toString("base64");
}

export function decryptValue(value: string): string {
  if (!value || !value.startsWith(ENC_PREFIX)) return value;
  if (!safeStorage.isEncryptionAvailable()) return value;
  try {
    const buf = Buffer.from(value.slice(ENC_PREFIX.length), "base64");
    return safeStorage.decryptString(buf);
  } catch {
    return value;
  }
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export { ENC_PREFIX };

// --- Network exposure detection ---

const EXPOSURE_CHECK_INTERVAL = 60_000; // 60s
let exposureCheckTimer: ReturnType<typeof setInterval> | null = null;
let _isDaemonRunning: () => boolean = () => false;
let _daemonPort = 18789;

export function configureExposureMonitor(opts: { isDaemonRunning: () => boolean; port: number }) {
  _isDaemonRunning = opts.isDaemonRunning;
  _daemonPort = opts.port;
}

function getLocalIPs(): string[] {
  const ips: string[] = [];
  const nets = networkInterfaces();
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const info of iface) {
      if (!info.internal && info.family === "IPv4") {
        ips.push(info.address);
      }
    }
  }
  return ips;
}

async function checkNetworkExposure() {
  if (!_isDaemonRunning()) return;

  const localIPs = getLocalIPs();
  for (const ip of localIPs) {
    try {
      const res = await fetch(`http://${ip}:${_daemonPort}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res) {
        pushSecurityAlert({
          id: "network-exposure",
          level: "error",
          title: "Gateway 公网暴露",
          detail: `端口 ${_daemonPort} 可从 ${ip} 访问，存在未授权访问风险。建议在「安全」页面开启「禁止公网暴露」。`,
          action: "go-security",
        });
        return;
      }
    } catch {
      // Not reachable — safe
    }
  }
}

export function startExposureMonitor() {
  stopExposureMonitor();
  setTimeout(() => checkNetworkExposure(), 5000);
  exposureCheckTimer = setInterval(checkNetworkExposure, EXPOSURE_CHECK_INTERVAL);
}

export function stopExposureMonitor() {
  if (exposureCheckTimer) {
    clearInterval(exposureCheckTimer);
    exposureCheckTimer = null;
  }
}

// --- Security config helpers ---

const defaultSecurity = {
  blockPublicExpose: true,
  blockShellAccess: true,
  blockFullDiskAccess: true,
  encryptCredentials: true,
  groupChatEnabled: false,
  groupChatWhitelist: [] as string[],
  promptScanEnabled: true,
};

export function getSecurityConfig() {
  const filepath = path.join(getConfigDir(), "security.json");
  if (fs.existsSync(filepath)) {
    try {
      return JSON.parse(fs.readFileSync(filepath, "utf-8"));
    } catch { /* fall through */ }
  }
  return { ...defaultSecurity };
}

/**
 * Sync security policies into OpenClaw's openclaw.json so the gateway enforces them.
 *
 * Actual OpenClaw config schema (verified from source):
 * - Shell:  tools.exec.security = "deny" | "allowlist" | "full"
 * - Disk:   tools.fs.workspaceOnly = true/false
 * - Group:  channels.feishu.groupPolicy = "disabled" | "allowlist" | "open"
 *           channels.feishu.groupAllowFrom = string[]
 */
export function syncSecurityToOpenClaw(config: typeof defaultSecurity) {
  try {
    let cfg: Record<string, unknown> = {};
    const ocConfigPath = getOpenclawConfigPath();
    if (fs.existsSync(ocConfigPath)) {
      cfg = JSON.parse(fs.readFileSync(ocConfigPath, "utf-8"));
    }

    // Shell access: tools.exec.security
    if (!cfg.tools || typeof cfg.tools !== "object") cfg.tools = {};
    const tools = cfg.tools as Record<string, unknown>;
    if (!tools.exec || typeof tools.exec !== "object") tools.exec = {};
    const exec = tools.exec as Record<string, unknown>;
    exec.security = config.blockShellAccess ? "deny" : "full";

    // File access: tools.fs.workspaceOnly
    if (!tools.fs || typeof tools.fs !== "object") tools.fs = {};
    const fsConfig = tools.fs as Record<string, unknown>;
    fsConfig.workspaceOnly = config.blockFullDiskAccess;

    // Group chat: channels.feishu.groupPolicy + groupAllowFrom
    if (cfg.channels && typeof cfg.channels === "object") {
      const channels = cfg.channels as Record<string, Record<string, unknown>>;
      if (channels.feishu) {
        if (config.groupChatEnabled) {
          channels.feishu.groupPolicy = config.groupChatWhitelist.length > 0 ? "allowlist" : "open";
          channels.feishu.groupAllowFrom = config.groupChatWhitelist;
        } else {
          channels.feishu.groupPolicy = "disabled";
          channels.feishu.groupAllowFrom = [];
        }
      }
    }

    fs.writeFileSync(ocConfigPath, JSON.stringify(cfg, null, 2));
    pushLog("info", "system", "安全策略已同步到 OpenClaw 配置");
  } catch (err) {
    pushLog("error", "system", `同步安全策略到 OpenClaw 失败: ${err}`);
  }
}

// --- Prompt injection scanner (built-in, no third-party runtime dependency) ---

export type PromptRiskLevel = "safe" | "low" | "medium" | "high";

export interface PromptScanResult {
  level: PromptRiskLevel;
  matched: string[];
}

// Chinese-specific prompt-injection patterns
const CJK_HIGH_RISK = [
  /忽略(?:以上|之前|所有)(?:的)?(?:指令|规则|提示|设定)/,
  /(?:执行|运行)(?:系统|shell)?命令/,
  /将.{0,20}(?:发送|传输|泄露)(?:给|到|至)/,
];
const CJK_MEDIUM_RISK = [
  /(?:显示|输出|打印|告诉我)(?:你的)?(?:系统|初始)?(?:提示词|指令|设定)/,
  /(?:越狱|破解|绕过)(?:模式|限制)?/,
];

// English prompt-injection / leakage patterns
const EN_HIGH_RISK = [
  /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|rules?|prompts?)/i,
  /(?:execute|run)\s+(?:system|shell|bash|cmd)\s+command/i,
  /(?:send|transmit|exfiltrate)\s+.{0,30}(?:to|via)\s+(?:http|ftp|webhook)/i,
  /\bsudo\b.*\brm\b|\brm\s+-rf\b/i,
];
const EN_MEDIUM_RISK = [
  /(?:show|display|print|reveal|output)\s+(?:your\s+)?(?:system|initial|original)\s+(?:prompt|instructions?)/i,
  /(?:jailbreak|bypass|circumvent)\s+(?:mode|restrictions?|filters?|safety)/i,
  /(?:DAN|developer)\s+mode/i,
  /you\s+are\s+now\s+(?:a|an)\s+(?:unrestricted|unfiltered)/i,
];

export async function scanPrompt(text: string): Promise<PromptScanResult> {
  if (!text) return { level: "safe", matched: [] };

  const matched: string[] = [];
  let highestScore = 0;

  // Built-in pattern matching
  for (const pattern of CJK_HIGH_RISK) {
    const m = text.match(pattern);
    if (m) { highestScore = Math.max(highestScore, 1); matched.push(`[中文注入] ${m[0]}`); }
  }
  for (const pattern of CJK_MEDIUM_RISK) {
    const m = text.match(pattern);
    if (m) { highestScore = Math.max(highestScore, 0.5); matched.push(`[中文可疑] ${m[0]}`); }
  }
  for (const pattern of EN_HIGH_RISK) {
    const m = text.match(pattern);
    if (m) { highestScore = Math.max(highestScore, 1); matched.push(`[Injection] ${m[0]}`); }
  }
  for (const pattern of EN_MEDIUM_RISK) {
    const m = text.match(pattern);
    if (m) { highestScore = Math.max(highestScore, 0.5); matched.push(`[Suspicious] ${m[0]}`); }
  }

  if (highestScore >= 0.8) return { level: "high", matched };
  if (highestScore >= 0.5 || matched.length > 0) return { level: "medium", matched };
  return { level: "safe", matched: [] };
}
