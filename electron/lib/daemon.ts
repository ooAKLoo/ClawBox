import { spawn, ChildProcess } from "child_process";
import crypto from "crypto";
import { pushLog } from "./logger";
import { getOpenClawCommand } from "./runtime";
import { startExposureMonitor, stopExposureMonitor, getSecurityConfig, syncSecurityToOpenClaw } from "./security";

export const DAEMON_PORT = 18789;
const DAEMON_START_TIMEOUT = 15000;
const DAEMON_POLL_INTERVAL = 500;

let daemonProcess: ChildProcess | null = null;
let gatewayToken = "";

export function getDaemonProcess(): ChildProcess | null {
  return daemonProcess;
}

export function getGatewayToken(): string {
  return gatewayToken;
}

export function isDaemonRunning(): boolean {
  return daemonProcess !== null;
}

/** Authenticated fetch to the local gateway */
export function gatewayFetch(url: string, init?: RequestInit & { signal?: AbortSignal }): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (gatewayToken) {
    headers.set("Authorization", `Bearer ${gatewayToken}`);
  }
  return fetch(url, { ...init, headers });
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await gatewayFetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, DAEMON_POLL_INTERVAL));
    }
  }
  return false;
}

export function spawnDaemon(): Promise<{ success: boolean; message: string }> {
  return new Promise(async (resolve, reject) => {
    gatewayToken = crypto.randomBytes(32).toString("hex");

    // Read security config and sync to OpenClaw before spawning
    const securityCfg = getSecurityConfig();
    syncSecurityToOpenClaw(securityCfg);

    const { cmd, args, env } = getOpenClawCommand();
    const bind = securityCfg.blockPublicExpose ? "loopback" : "lan";
    const fullArgs = [...args, "gateway", "run", "--port", String(DAEMON_PORT), "--bind", bind, "--force", "--allow-unconfigured", "--auth", "token", "--verbose"];
    const daemonEnv = { ...env, OPENCLAW_AUTH_TOKEN: gatewayToken };
    console.log("[ClawBox] Spawning gateway:", cmd, fullArgs.join(" "));
    daemonProcess = spawn(cmd, fullArgs, { shell: true, env: daemonEnv });

    let exited = false;
    daemonProcess.stdout?.on("data", (d) => {
      const line = d.toString().trim();
      if (!line) return;
      console.log("[daemon stdout]", line);
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
      pushLog("info", "system", "Gateway 已启动（Token 认证已启用）");
      startExposureMonitor();
      resolve({ success: true, message: "Daemon started" });
    } else if (exited) {
      stopExposureMonitor();
      resolve({ success: false, message: "Daemon process exited before port became reachable" });
    } else {
      if (daemonProcess) {
        daemonProcess.kill();
        daemonProcess = null;
      }
      stopExposureMonitor();
      resolve({ success: false, message: `Daemon failed to listen on port ${DAEMON_PORT} within ${DAEMON_START_TIMEOUT / 1000}s` });
    }
  });
}

export async function startDaemon(): Promise<{ success: boolean; message: string }> {
  if (daemonProcess) {
    const reachable = await waitForPort(DAEMON_PORT, 2000);
    if (reachable) {
      return { success: true, message: "Daemon already running" };
    }
    daemonProcess.kill();
    daemonProcess = null;
  }
  return spawnDaemon();
}

export async function stopDaemon(): Promise<{ success: boolean }> {
  stopExposureMonitor();
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
  }
  return { success: true };
}

export async function restartDaemon(): Promise<{ success: boolean; message: string }> {
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
  }
  await new Promise((r) => setTimeout(r, 500));
  return spawnDaemon();
}

export async function getDaemonStatus(): Promise<{ running: boolean; pid: number | null; port: number }> {
  let portReachable = false;
  if (daemonProcess !== null) {
    try {
      await gatewayFetch("http://127.0.0.1:18789", { signal: AbortSignal.timeout(2000) });
      portReachable = true;
    } catch { /* */ }
  }
  return {
    running: daemonProcess !== null && portReachable,
    pid: daemonProcess?.pid ?? null,
    port: DAEMON_PORT,
  };
}

/** Ensure Gateway is running, start it if not. */
export async function ensureGateway(): Promise<boolean> {
  try {
    await gatewayFetch(`http://127.0.0.1:${DAEMON_PORT}`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch { /* not running */ }

  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
    await new Promise((r) => setTimeout(r, 500));
  }
  pushLog("info", "system", "助手需要 Gateway，正在自动启动...");
  const result = await spawnDaemon();
  return result.success;
}

export function killDaemon() {
  stopExposureMonitor();
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
  }
}
