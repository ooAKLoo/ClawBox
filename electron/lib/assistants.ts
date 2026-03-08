import path from "path";
import fs from "fs";
import { readJsonFile, writeJsonFile, openclawConfigDir, openclawConfigPath } from "./config";
import { pushLog, pushSecurityAlert } from "./logger";
import { runOpenClaw } from "./runtime";
import { ensureGateway } from "./daemon";
import { scanPrompt } from "./security";

interface AssistantConfig {
  id: string;
  name: string;
  icon: string;
  sceneId: string | null;
  status: "running" | "paused";
  trigger: string;
  systemPrompt: string;
  params: Record<string, string>;
  cronJobId?: string;
  createdAt: number;
}

export function readAssistants(): AssistantConfig[] {
  const raw = readJsonFile("assistants.json");
  return raw?.assistants ?? [];
}

function writeAssistants(assistants: AssistantConfig[]) {
  writeJsonFile("assistants.json", { assistants });
}

function buildSoulPrompt(name: string, systemPrompt: string): string {
  return `# SOUL.md - ${name}\n\n${systemPrompt}\n`;
}

function timeToCron(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${m ?? 0} ${h ?? 8} * * *`;
}

function getConfiguredChannel(): string {
  try {
    if (fs.existsSync(openclawConfigPath)) {
      const cfg = JSON.parse(fs.readFileSync(openclawConfigPath, "utf-8"));
      const channels = cfg.channels as Record<string, { enabled?: boolean }> | undefined;
      if (channels) {
        for (const [name, ch] of Object.entries(channels)) {
          if (ch && ch.enabled !== false) return name;
        }
      }
    }
  } catch { /* ignore */ }
  return "last";
}

export async function createAssistant(config: Omit<AssistantConfig, "id" | "createdAt">) {
  try {
    // Scan system prompt for injection risks
    const scanResult = await scanPrompt(config.systemPrompt);
    if (scanResult.level === "high") {
      pushLog("error", "assistant", `系统提示词检测到高危内容: ${scanResult.matched.join(", ")}`);
      pushSecurityAlert({
        id: `prompt-injection-${Date.now()}`,
        level: "error",
        title: "Prompt 注入检测",
        detail: `助手「${config.name}」的系统提示词包含高危内容，已阻止创建。`,
      });
      return { success: false, error: `系统提示词包含高危内容，已阻止创建: ${scanResult.matched.join(", ")}` };
    }
    if (scanResult.level === "medium") {
      pushLog("warn", "assistant", `系统提示词检测到可疑内容: ${scanResult.matched.join(", ")}`);
      pushSecurityAlert({
        id: `prompt-warning-${Date.now()}`,
        level: "warn",
        title: "Prompt 可疑内容",
        detail: `助手「${config.name}」的系统提示词包含可疑内容，已放行但请留意。`,
      });
    }

    const id = `ast-${Date.now()}`;
    const workspaceDir = path.join(openclawConfigDir, "assistant-workspaces", id);

    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, "SOUL.md"), buildSoulPrompt(config.name, config.systemPrompt));
    fs.writeFileSync(path.join(workspaceDir, "IDENTITY.md"), [
      "# IDENTITY.md",
      "",
      `- **Name:** ${config.name}`,
      `- **Vibe:** helpful, concise`,
      "",
    ].join("\n"));

    const addResult = await runOpenClaw([
      "agents", "add", id,
      "--workspace", workspaceDir,
      "--non-interactive",
      "--json",
    ]);
    pushLog("info", "assistant", `Create agent ${id}: code=${addResult.code} stdout=${addResult.stdout}`);

    if (addResult.code !== 0 && !addResult.stdout.includes(id)) {
      return { success: false, error: `创建 Agent 失败: ${addResult.stderr || addResult.stdout}` };
    }

    let cronJobId: string | undefined;
    const timeMatch = config.trigger.match(/每天\s*(\d{2}:\d{2})/);
    if (timeMatch) {
      const gwReady = await ensureGateway();
      if (!gwReady) {
        await runOpenClaw(["agents", "delete", id, "--json"]);
        fs.rmSync(workspaceDir, { recursive: true, force: true });
        return { success: false, error: "Gateway 启动失败，无法创建定时任务。请先在「通道」页面确认 Gateway 可正常启动。" };
      }

      const cronExpr = timeToCron(timeMatch[1]);
      const deliveryChannel = getConfiguredChannel();
      const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
      pushLog("info", "assistant", `Cron: channel=${deliveryChannel}, tz=${systemTz}, expr=${cronExpr}`);
      const cronResult = await runOpenClaw([
        "cron", "add",
        "--agent", id,
        "--name", config.name,
        "--cron", cronExpr,
        "--message", `请执行你的任务: ${config.name}`,
        "--channel", deliveryChannel,
        "--tz", systemTz,
        "--announce",
        "--json",
      ]);
      pushLog("info", "assistant", `Create cron for ${id}: code=${cronResult.code} stdout=${cronResult.stdout} stderr=${cronResult.stderr}`);

      if (cronResult.code !== 0) {
        await runOpenClaw(["agents", "delete", id, "--json"]);
        fs.rmSync(workspaceDir, { recursive: true, force: true });
        return { success: false, error: `定时任务创建失败: ${cronResult.stderr || cronResult.stdout}` };
      }

      try {
        const cronData = JSON.parse(cronResult.stdout);
        cronJobId = cronData.id || cronData.jobId;
      } catch {
        const idMatch = cronResult.stdout.match(/"id"\s*:\s*"([^"]+)"/);
        if (idMatch) cronJobId = idMatch[1];
      }

      if (!cronJobId) {
        pushLog("warn", "assistant", `Cron job created but could not extract job id from output`);
      }
    }

    const assistant: AssistantConfig = {
      id,
      name: config.name,
      icon: config.icon,
      sceneId: config.sceneId,
      status: config.status,
      trigger: config.trigger,
      systemPrompt: config.systemPrompt,
      params: config.params,
      cronJobId,
      createdAt: Date.now(),
    };

    const assistants = readAssistants();
    assistants.unshift(assistant);
    writeAssistants(assistants);

    pushLog("info", "assistant", `助手「${config.name}」已创建 (${id})`);
    return { success: true, assistant };
  } catch (err) {
    pushLog("error", "assistant", `创建助手失败: ${err}`);
    return { success: false, error: String(err) };
  }
}

export async function removeAssistant(id: string) {
  try {
    const assistants = readAssistants();
    const target = assistants.find((a) => a.id === id);
    if (!target) return { success: false, error: "助手不存在" };

    if (target.cronJobId) {
      await ensureGateway();
      const rmResult = await runOpenClaw(["cron", "rm", target.cronJobId]);
      pushLog("info", "assistant", `删除定时任务 ${target.cronJobId}: code=${rmResult.code}`);
    }

    const delResult = await runOpenClaw(["agents", "delete", id, "--json"]);
    pushLog("info", "assistant", `Delete agent ${id}: code=${delResult.code}`);

    const workspaceDir = path.join(openclawConfigDir, "assistant-workspaces", id);
    if (fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }

    writeAssistants(assistants.filter((a) => a.id !== id));
    pushLog("info", "assistant", `助手「${target.name}」已移除`);
    return { success: true };
  } catch (err) {
    pushLog("error", "assistant", `移除助手失败: ${err}`);
    return { success: false, error: String(err) };
  }
}

export async function toggleAssistant(id: string) {
  try {
    const assistants = readAssistants();
    const target = assistants.find((a) => a.id === id);
    if (!target) return { success: false, error: "助手不存在" };

    const newStatus = target.status === "running" ? "paused" : "running";

    if (target.cronJobId) {
      await ensureGateway();
      if (newStatus === "paused") {
        await runOpenClaw(["cron", "disable", target.cronJobId]);
      } else {
        await runOpenClaw(["cron", "enable", target.cronJobId]);
      }
      pushLog("info", "assistant", `定时任务 ${target.cronJobId} 已${newStatus === "paused" ? "暂停" : "启用"}`);
    }

    target.status = newStatus;
    writeAssistants(assistants);

    pushLog("info", "assistant", `助手「${target.name}」已${newStatus === "paused" ? "暂停" : "启用"}`);
    return { success: true };
  } catch (err) {
    pushLog("error", "assistant", `切换助手状态失败: ${err}`);
    return { success: false, error: String(err) };
  }
}
