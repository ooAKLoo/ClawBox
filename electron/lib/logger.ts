import type { BrowserWindow } from "electron";

export type LogLevel = "info" | "warn" | "error";
export type LogCategory = "system" | "model" | "gateway";

export interface LogEntry {
  time: string;
  level: LogLevel;
  category: LogCategory;
  msg: string;
}

const MAX_LOG_ENTRIES = 2000;
const logBuffer: LogEntry[] = [];

let _mainWindow: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow | null) {
  _mainWindow = win;
}

export function pushLog(level: LogLevel, category: LogCategory, msg: string) {
  const entry: LogEntry = {
    time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    level,
    category,
    msg,
  };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) logBuffer.splice(0, logBuffer.length - MAX_LOG_ENTRIES);
  _mainWindow?.webContents.send("daemon-log", entry);
}

export function getLogBuffer(): LogEntry[] {
  return logBuffer;
}

export function clearLogBuffer() {
  logBuffer.length = 0;
}

// --- Security alert push ---

export interface SecurityAlert {
  id: string;
  level: "warn" | "error";
  title: string;
  detail: string;
  action?: string;
}

export function pushSecurityAlert(alert: SecurityAlert) {
  pushLog(alert.level, "system", `[安全告警] ${alert.title}: ${alert.detail}`);
  _mainWindow?.webContents.send("security-alert", alert);
}
