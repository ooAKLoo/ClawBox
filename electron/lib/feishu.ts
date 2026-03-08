import path from "path";
import fs from "fs";
import { readJsonFile, writeSecureJsonFile, readSecureJsonFile, openclawConfigDir, openclawConfigPath } from "./config";
import { pushLog } from "./logger";
import { getLogBuffer } from "./logger";
import { detectBundledRuntime } from "./runtime";
import { isDaemonRunning, restartDaemon, spawnDaemon } from "./daemon";
import { getSecurityConfig } from "./security";

const FEISHU_SENSITIVE_KEYS = ["appSecret", "encryptKey"];

export function syncFeishuToOpenClaw(config: { appId: string; appSecret: string; verificationToken?: string; encryptKey?: string }) {
  try {
    let cfg: Record<string, unknown> = {};
    if (fs.existsSync(openclawConfigPath)) {
      cfg = JSON.parse(fs.readFileSync(openclawConfigPath, "utf-8"));
    }

    if (!cfg.channels || typeof cfg.channels !== "object") cfg.channels = {};
    const channels = cfg.channels as Record<string, unknown>;

    if (config.appId && config.appSecret) {
      const securityCfg = getSecurityConfig();
      const feishuCfg: Record<string, unknown> = {
        enabled: true,
        appId: config.appId,
        appSecret: config.appSecret,
        dmPolicy: "open",
      };
      if (config.verificationToken) feishuCfg.verificationToken = config.verificationToken;
      if (config.encryptKey) feishuCfg.encryptKey = config.encryptKey;

      // Apply group chat policy from security config
      if (securityCfg.groupChatEnabled) {
        const whitelist = securityCfg.groupChatWhitelist || [];
        feishuCfg.groupPolicy = whitelist.length > 0 ? "allowlist" : "open";
        feishuCfg.groupAllowFrom = whitelist;
      } else {
        feishuCfg.groupPolicy = "disabled";
        feishuCfg.groupAllowFrom = [];
      }
      channels.feishu = feishuCfg;
    } else {
      delete channels.feishu;
    }

    fs.writeFileSync(openclawConfigPath, JSON.stringify(cfg, null, 2));
    pushLog("info", "system", "已同步飞书配置到 OpenClaw");
  } catch (err) {
    pushLog("error", "system", `同步飞书配置到 OpenClaw 失败: ${err}`);
  }
}

export async function saveFeishuConfig(config: Record<string, unknown>) {
  writeSecureJsonFile("feishu.json", config, FEISHU_SENSITIVE_KEYS);
  syncFeishuToOpenClaw(config as { appId: string; appSecret: string; verificationToken?: string; encryptKey?: string });

  if (isDaemonRunning()) {
    pushLog("info", "system", "飞书配置已变更，正在重启 Gateway...");
    await restartDaemon();
  }

  return { success: true };
}

export function getFeishuConfig() {
  return readSecureJsonFile("feishu.json", FEISHU_SENSITIVE_KEYS);
}

export async function testFeishuConnection() {
  const config = readSecureJsonFile("feishu.json", FEISHU_SENSITIVE_KEYS);
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
}

export async function feishuPreflight(config: { appId: string; appSecret: string }) {
  const checks: { key: string; label: string; passed: boolean; detail: string; fixUrl?: string }[] = [];
  const appUrl = `https://open.feishu.cn/app/${config.appId}`;

  let token = "";
  try {
    const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
    });
    const data = await res.json() as { code: number; tenant_access_token?: string; msg?: string };
    if (data.code === 0 && data.tenant_access_token) {
      token = data.tenant_access_token;
      checks.push({ key: "credentials", label: "应用凭证", passed: true, detail: "App ID / Secret 验证通过" });
    } else {
      checks.push({ key: "credentials", label: "应用凭证", passed: false, detail: data.msg || "认证失败，请检查 App ID 和 Secret", fixUrl: `${appUrl}/baseinfo` });
      return checks;
    }
  } catch (err) {
    checks.push({ key: "credentials", label: "应用凭证", passed: false, detail: `网络错误: ${String(err)}` });
    return checks;
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    const res = await fetch("https://open.feishu.cn/open-apis/bot/v3/info", { headers });
    const data = await res.json() as { code: number; msg?: string; bot?: { app_name?: string } };
    if (data.code === 0) {
      checks.push({ key: "bot", label: "机器人能力", passed: true, detail: data.bot?.app_name ? `机器人: ${data.bot.app_name}` : "机器人已启用" });
    } else {
      checks.push({ key: "bot", label: "机器人能力", passed: false, detail: "未启用机器人能力，请在「添加应用能力」中添加「机器人」", fixUrl: `${appUrl}/bot` });
    }
  } catch {
    checks.push({ key: "bot", label: "机器人能力", passed: false, detail: "检测失败" });
  }

  try {
    const res = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id", {
      method: "POST",
      headers,
      body: JSON.stringify({ receive_id: "___preflight_test___", msg_type: "text", content: "{}" }),
    });
    const data = await res.json() as { code: number; msg?: string };
    if (data.code === 99991672) {
      checks.push({
        key: "send_permission",
        label: "发消息权限",
        passed: false,
        detail: "缺少 im:message:send_as_bot 权限",
        fixUrl: `https://open.feishu.cn/app/${config.appId}/auth?q=im:message:send_as_bot&op_from=openapi&token_type=tenant`,
      });
    } else {
      checks.push({ key: "send_permission", label: "发消息权限", passed: true, detail: "im:message:send_as_bot 已开通" });
    }
  } catch {
    checks.push({ key: "send_permission", label: "发消息权限", passed: false, detail: "检测失败" });
  }

  try {
    const res = await fetch("https://open.feishu.cn/open-apis/contact/v3/users?page_size=1", { headers });
    const data = await res.json() as { code: number; msg?: string };
    if (data.code === 99991672) {
      checks.push({
        key: "contact_permission",
        label: "通讯录权限",
        passed: false,
        detail: "缺少 contact:contact.base:readonly 权限",
        fixUrl: `https://open.feishu.cn/app/${config.appId}/auth?q=contact:contact.base:readonly&op_from=openapi&token_type=tenant`,
      });
    } else {
      checks.push({ key: "contact_permission", label: "通讯录权限", passed: true, detail: "contact:contact.base:readonly 已开通" });
    }
  } catch {
    checks.push({ key: "contact_permission", label: "通讯录权限", passed: false, detail: "检测失败" });
  }

  checks.push({
    key: "receive_permission",
    label: "接收消息权限",
    passed: true,
    detail: "请确认已在飞书开放平台开通 im:message.p2p_msg:readonly 权限并发布版本",
  });

  return checks;
}

export async function activateFeishuChannel(config: { appId: string; appSecret: string; verificationToken?: string; encryptKey?: string }) {
  const runtime = detectBundledRuntime();
  if (!runtime.available) {
    return { success: false, stage: "check", error: "OpenClaw 运行时缺失，请先完成环境安装" };
  }

  const checks = await feishuPreflight(config);
  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    return { success: false, stage: "preflight", error: `预检未通过: ${failed.map((c) => c.label).join("、")}`, checks };
  }

  writeSecureJsonFile("feishu.json", config as Record<string, unknown>, FEISHU_SENSITIVE_KEYS);
  pushLog("info", "system", "飞书配置已保存（凭证已加密）");

  syncFeishuToOpenClaw(config);

  const dedupPath = path.join(openclawConfigDir, "feishu", "dedup", "default.json");
  if (fs.existsSync(dedupPath)) {
    try { fs.unlinkSync(dedupPath); } catch { /* ok */ }
  }

  const wasRunning = isDaemonRunning();
  pushLog("info", "system", wasRunning ? "正在重启 Gateway 以应用飞书配置..." : "正在启动 Gateway...");

  const logBuffer = getLogBuffer();
  const logStartIndex = logBuffer.length;

  const spawnResult = wasRunning ? await restartDaemon() : await spawnDaemon();
  if (!spawnResult.success) {
    return { success: false, stage: "gateway", error: `Gateway 启动失败: ${spawnResult.message}` };
  }

  const WS_TIMEOUT = 15000;
  const WS_POLL = 500;
  const deadline = Date.now() + WS_TIMEOUT;

  while (Date.now() < deadline) {
    for (let i = logStartIndex; i < logBuffer.length; i++) {
      const msg = logBuffer[i].msg;
      if (/WebSocket client started/i.test(msg) || /feishu.*websocket/i.test(msg.toLowerCase())) {
        pushLog("info", "system", "飞书长连接已建立");
        return { success: true, stage: "connected", checks };
      }
      if (/feishu/i.test(msg) && logBuffer[i].level === "error") {
        return { success: false, stage: "feishu", error: msg, checks };
      }
    }
    await new Promise((r) => setTimeout(r, WS_POLL));
  }

  return { success: false, stage: "timeout", error: "飞书长连接未在 15 秒内建立，请检查事件订阅是否已配置长连接模式，以及应用是否已发布", checks };
}
