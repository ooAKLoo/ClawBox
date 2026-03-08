import fs from "fs";
import { readJsonFile, writeJsonFile, openclawConfigPath } from "./config";
import { encryptValue, decryptValue, ENC_PREFIX } from "./security";
import { pushLog } from "./logger";
import { isDaemonRunning, restartDaemon } from "./daemon";

export function readModelData(): { activeId: string | null; providers: Record<string, unknown> } {
  const raw = readJsonFile("model.json");
  if (!raw) return { activeId: null, providers: {} };
  // Migrate old flat format → new multi-provider format
  if (raw.id && !raw.activeId) {
    const migrated = { activeId: raw.id, providers: { [raw.id]: raw } };
    writeModelData(migrated);
    return migrated;
  }
  // Decrypt apiKey in each provider
  const providers = raw.providers ?? {};
  for (const key of Object.keys(providers)) {
    const p = providers[key] as Record<string, unknown>;
    if (typeof p?.apiKey === "string" && p.apiKey.startsWith(ENC_PREFIX)) {
      p.apiKey = decryptValue(p.apiKey);
    }
  }
  return { activeId: raw.activeId ?? null, providers };
}

export function writeModelData(data: { activeId: string | null; providers: Record<string, unknown> }) {
  const clone = JSON.parse(JSON.stringify(data));
  for (const key of Object.keys(clone.providers ?? {})) {
    const p = clone.providers[key];
    if (typeof p?.apiKey === "string" && p.apiKey && !p.apiKey.startsWith(ENC_PREFIX)) {
      p.apiKey = encryptValue(p.apiKey);
    }
  }
  writeJsonFile("model.json", clone);
}

/** Map ClawBox provider IDs to OpenClaw provider IDs */
function toOpenClawProviderId(clawboxId: string): string {
  const map: Record<string, string> = {
    qwen: "dashscope",
    kimi: "moonshot",
  };
  return map[clawboxId] ?? clawboxId;
}

/** Sync active model config to OpenClaw's openclaw.json */
export function syncModelToOpenClaw(provider: { id: string; name: string; baseUrl: string; apiKey: string; model: string }) {
  try {
    let cfg: Record<string, unknown> = {};
    if (fs.existsSync(openclawConfigPath)) {
      cfg = JSON.parse(fs.readFileSync(openclawConfigPath, "utf-8"));
    }

    const ocProviderId = toOpenClawProviderId(provider.id);

    if (!cfg.models || typeof cfg.models !== "object") cfg.models = {};
    const models = cfg.models as Record<string, unknown>;
    if (!models.providers || typeof models.providers !== "object") models.providers = {};
    const providers = models.providers as Record<string, unknown>;

    providers[ocProviderId] = {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      models: [{ id: provider.model, name: `${provider.name} ${provider.model}`, api: "openai-completions" }],
    };

    if (!cfg.agents || typeof cfg.agents !== "object") cfg.agents = {};
    const agents = cfg.agents as Record<string, unknown>;
    if (!agents.defaults || typeof agents.defaults !== "object") agents.defaults = {};
    const defaults = agents.defaults as Record<string, unknown>;
    defaults.model = `${ocProviderId}/${provider.model}`;

    fs.writeFileSync(openclawConfigPath, JSON.stringify(cfg, null, 2));
    pushLog("info", "model", `已同步模型配置到 OpenClaw: ${ocProviderId}/${provider.model}`);
  } catch (err) {
    pushLog("error", "model", `同步模型配置到 OpenClaw 失败: ${err}`);
  }
}

export async function saveModelConfig(provider: Record<string, unknown>) {
  const data = readModelData();
  data.activeId = provider.id as string;
  data.providers[provider.id as string] = provider;
  writeModelData(data);

  syncModelToOpenClaw(provider as { id: string; name: string; baseUrl: string; apiKey: string; model: string });

  if (isDaemonRunning()) {
    pushLog("info", "system", "模型配置已变更，正在重启 Gateway...");
    await restartDaemon();
  }

  return { success: true };
}

export async function testModelConnection(provider: { baseUrl: string; apiKey: string; model: string }) {
  const start = Date.now();
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
    });
    const latency = Date.now() - start;
    if (response.ok) {
      return { success: true, latency };
    }
    const text = await response.text();
    return { success: false, latency, error: text };
  } catch (err) {
    return { success: false, latency: Date.now() - start, error: String(err) };
  }
}
