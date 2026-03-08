import fs from "fs";
import path from "path";
import { pushLog } from "./logger";

const openclawHome = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".openclaw"
);
const agentsDir = path.join(openclawHome, "agents");

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

/** Scan all OpenClaw session JSONL files and aggregate token usage by provider/model */
export function getUsageStats(): UsageStats {
  const stats: UsageStats = {
    byProvider: {},
    total: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 },
  };

  if (!fs.existsSync(agentsDir)) return stats;

  try {
    const agents = fs.readdirSync(agentsDir);
    for (const agentId of agents) {
      const sessionsDir = path.join(agentsDir, agentId, "sessions");
      if (!fs.existsSync(sessionsDir)) continue;

      const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));
      for (const file of files) {
        parseSessionFile(path.join(sessionsDir, file), stats);
      }
    }
  } catch (err) {
    pushLog("warn", "system", `读取用量统计失败: ${err}`);
  }

  return stats;
}

function parseSessionFile(filePath: string, stats: UsageStats) {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return;
  }

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (msg?.role !== "assistant" || !msg.usage) continue;

      const provider = msg.provider || "unknown";
      const model = msg.model || "unknown";
      const input = msg.usage.input || 0;
      const output = msg.usage.output || 0;

      // Skip zero-usage entries (errors, injected messages)
      if (input === 0 && output === 0) continue;

      // Ensure provider bucket
      if (!stats.byProvider[provider]) {
        stats.byProvider[provider] = {
          inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, models: {},
        };
      }
      const prov = stats.byProvider[provider];

      // Ensure model bucket
      if (!prov.models[model]) {
        prov.models[model] = {
          provider, model, inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0,
        };
      }
      const mdl = prov.models[model];

      // Accumulate
      mdl.inputTokens += input;
      mdl.outputTokens += output;
      mdl.totalTokens += input + output;
      mdl.requests += 1;

      prov.inputTokens += input;
      prov.outputTokens += output;
      prov.totalTokens += input + output;
      prov.requests += 1;

      stats.total.inputTokens += input;
      stats.total.outputTokens += output;
      stats.total.totalTokens += input + output;
      stats.total.requests += 1;
    } catch {
      // skip malformed lines
    }
  }
}
