import path from "path";
import fs from "fs";
import { openclawConfigDir, openclawConfigPath } from "./config";
import { getBundledRuntimeDir, runOpenClaw } from "./runtime";
import { pushLog } from "./logger";

// ── Types ──

export interface SkillInstaller {
  id: string;
  kind: string;
  label: string;
  command: string; // e.g. "brew install steipete/tap/summarize"
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
  kind: string; // "channel" | "memory" | "provider" | ""
  channels: string[];
  enabled: boolean;
  hasConfig: boolean;
  configFields: string[];
}

// ── Helpers ──

function readOpenClawConfig(): Record<string, unknown> {
  try {
    if (fs.existsSync(openclawConfigPath)) {
      return JSON.parse(fs.readFileSync(openclawConfigPath, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function writeOpenClawConfig(config: Record<string, unknown>) {
  const dir = path.dirname(openclawConfigPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(openclawConfigPath, JSON.stringify(config, null, 2));
}

function getBundledExtensionsDir(): string {
  const runtimeDir = getBundledRuntimeDir();
  return path.join(runtimeDir, "openclaw", "node_modules", "openclaw", "extensions");
}

function getBundledSkillsDir(): string {
  const runtimeDir = getBundledRuntimeDir();
  return path.join(runtimeDir, "openclaw", "node_modules", "openclaw", "skills");
}

const _commandCache = new Map<string, boolean>();

function commandExists(bin: string): boolean {
  const cached = _commandCache.get(bin);
  if (cached !== undefined) return cached;
  try {
    const { execSync } = require("child_process");
    const cmd = process.platform === "win32" ? `where ${bin}` : `which ${bin}`;
    execSync(cmd, { stdio: "ignore", timeout: 3000 });
    _commandCache.set(bin, true);
    return true;
  } catch {
    _commandCache.set(bin, false);
    return false;
  }
}

// ── Skills ──

function parseSkillMd(content: string): Partial<SkillInfo> {
  const result: Partial<SkillInfo> = {};

  // Parse YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return result;

  const fm = fmMatch[1];

  // name
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  if (nameMatch) result.name = nameMatch[1].trim();

  // description
  const descMatch = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  if (descMatch) result.description = descMatch[1].trim();

  // homepage
  const hpMatch = fm.match(/^homepage:\s*(.+)$/m);
  if (hpMatch) result.homepage = hpMatch[1].trim();

  // metadata block (JSON inside YAML)
  const metaMatch = fm.match(/^metadata:\s*\n\s*(\{[\s\S]*\})\s*$/m);
  if (metaMatch) {
    try {
      const meta = JSON.parse(metaMatch[1]);
      const oc = meta.openclaw || {};
      result.emoji = oc.emoji || "";
      result.os = oc.os || [];
      result.requires = {
        bins: oc.requires?.bins || [],
        env: oc.requires?.env || [],
      };
      result.install = (oc.install || []).map((i: Record<string, string>) => {
        let command = "";
        switch (i.kind) {
          case "brew": command = `brew install ${i.formula || i.id}`; break;
          case "go": command = `go install ${i.module || ""}`; break;
          case "uv": command = `uv tool install ${i.package || i.id}`; break;
          case "npm": command = `npm install -g ${i.package || i.id}`; break;
          case "pip": command = `pip install ${i.package || i.id}`; break;
          case "cargo": command = `cargo install ${i.crate || i.id}`; break;
          default: command = i.label || "";
        }
        return { id: i.id || "", kind: i.kind || "", label: i.label || "", command };
      });
    } catch { /* ignore parse error */ }
  }

  return result;
}

export function listSkills(): SkillInfo[] {
  const skills: SkillInfo[] = [];
  const config = readOpenClawConfig();
  const skillsConfig = (config.skills as Record<string, unknown>) || {};
  const entries = (skillsConfig.entries as Record<string, { enabled?: boolean }>) || {};
  const allowBundled = (skillsConfig.allowBundled as string[]) || [];

  const bundledDir = getBundledSkillsDir();
  if (!fs.existsSync(bundledDir)) return skills;

  const dirs = fs.readdirSync(bundledDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dirName of dirs) {
    const skillMdPath = path.join(bundledDir, dirName, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      const parsed = parseSkillMd(content);

      const name = parsed.name || dirName;
      const requires = parsed.requires || { bins: [], env: [] };

      // Check OS eligibility
      const osOk = !parsed.os || parsed.os.length === 0 || parsed.os.includes(process.platform);

      // Check binary requirements
      const binsOk = requires.bins.length === 0 || requires.bins.every(commandExists);

      // Check if enabled in config
      const entryEnabled = entries[name]?.enabled;
      const inAllowList = allowBundled.includes(name);
      const enabled = entryEnabled === true || inAllowList;

      skills.push({
        name,
        description: parsed.description || "",
        emoji: parsed.emoji || "",
        homepage: parsed.homepage || "",
        os: parsed.os || [],
        requires,
        install: parsed.install || [],
        eligible: osOk && binsOk,
        enabled,
      });
    } catch {
      // Skip broken skill files
    }
  }

  // Also check managed skills dir
  const managedDir = path.join(openclawConfigDir, "skills");
  if (fs.existsSync(managedDir)) {
    const managedDirs = fs.readdirSync(managedDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const dirName of managedDirs) {
      // Mark as enabled if it exists in managed dir (user installed)
      const existing = skills.find((s) => s.name === dirName);
      if (existing) {
        existing.enabled = true;
      }
    }
  }

  return skills;
}

export async function toggleSkill(name: string, enable: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const config = readOpenClawConfig();
    if (!config.skills) config.skills = {};
    const skills = config.skills as Record<string, unknown>;
    if (!skills.entries) skills.entries = {};
    const entries = skills.entries as Record<string, { enabled?: boolean }>;

    if (!entries[name]) entries[name] = {};
    entries[name].enabled = enable;

    writeOpenClawConfig(config);
    pushLog("info", "system", `Skill「${name}」已${enable ? "启用" : "禁用"}`);
    return { success: true };
  } catch (err) {
    pushLog("error", "system", `切换 Skill 失败: ${err}`);
    return { success: false, error: String(err) };
  }
}

// ── Plugins ──

export function listPlugins(): PluginInfo[] {
  const plugins: PluginInfo[] = [];
  const config = readOpenClawConfig();
  const pluginsConfig = (config.plugins as Record<string, unknown>) || {};
  const entries = (pluginsConfig.entries as Record<string, { enabled?: boolean }>) || {};
  const allow = (pluginsConfig.allow as string[]) || [];
  const deny = (pluginsConfig.deny as string[]) || [];

  const extDir = getBundledExtensionsDir();
  if (!fs.existsSync(extDir)) return plugins;

  const dirs = fs.readdirSync(extDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dirName of dirs) {
    const manifestPath = path.join(extDir, dirName, "openclaw.plugin.json");
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      const id = manifest.id || dirName;

      // Determine enabled state
      const entryEnabled = entries[id]?.enabled;
      const inAllow = allow.includes(id);
      const inDeny = deny.includes(id);
      const enabled = inDeny ? false : (entryEnabled === true || inAllow);

      // Extract config field names
      const configSchema = manifest.configSchema?.properties || {};
      const configFields = Object.keys(configSchema);

      plugins.push({
        id,
        name: manifest.name || id,
        kind: manifest.kind || (manifest.channels?.length ? "channel" : ""),
        channels: manifest.channels || [],
        enabled,
        hasConfig: configFields.length > 0,
        configFields,
      });
    } catch {
      // Skip broken manifests
    }
  }

  return plugins;
}

// ── Memory ──

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

export async function getMemoryStatus(): Promise<MemoryStatus> {
  const result: MemoryStatus = { available: false, backend: "unknown", files: [] };

  try {
    // Check which memory backend is configured
    const config = readOpenClawConfig();
    const pluginsConfig = (config.plugins as Record<string, unknown>) || {};
    const slots = (pluginsConfig.slots as Record<string, string>) || {};
    result.backend = slots.memory || "builtin";

    // Read memory source files from workspace
    const workspaceDir = path.join(openclawConfigDir, "workspace");
    const memoryDir = path.join(workspaceDir, "memory");

    // Main MEMORY.md
    const mainMemory = path.join(workspaceDir, "MEMORY.md");
    if (fs.existsSync(mainMemory)) {
      const stat = fs.statSync(mainMemory);
      result.files.push({ path: "MEMORY.md", size: stat.size, mtime: stat.mtimeMs });
    }

    // Daily memory files
    if (fs.existsSync(memoryDir)) {
      const dailyFiles = fs.readdirSync(memoryDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse(); // newest first
      for (const f of dailyFiles) {
        const stat = fs.statSync(path.join(memoryDir, f));
        result.files.push({ path: `memory/${f}`, size: stat.size, mtime: stat.mtimeMs });
      }
    }

    result.available = result.files.length > 0;
  } catch (err) {
    result.error = String(err);
    pushLog("error", "system", `读取记忆状态失败: ${err}`);
  }

  return result;
}

export async function readMemoryFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const workspaceDir = path.join(openclawConfigDir, "workspace");
    const fullPath = path.join(workspaceDir, filePath);

    // Prevent path traversal
    if (!fullPath.startsWith(workspaceDir)) {
      return { success: false, error: "非法路径" };
    }

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: "文件不存在" };
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    return { success: true, content };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function searchMemory(query: string): Promise<{ success: boolean; results?: MemorySearchResult[]; error?: string }> {
  try {
    const result = await runOpenClaw(["memory", "search", query, "--json"]);
    if (result.code !== 0) {
      return { success: false, error: result.stderr || "搜索失败" };
    }

    try {
      const parsed = JSON.parse(result.stdout);
      const results: MemorySearchResult[] = (parsed.results || parsed || []).map((r: Record<string, unknown>) => ({
        snippet: String(r.snippet || r.text || ""),
        path: String(r.path || r.file || ""),
        score: Number(r.score || 0),
      }));
      return { success: true, results };
    } catch {
      return { success: true, results: [] };
    }
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function togglePlugin(id: string, enable: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    // Use CLI for proper plugin lifecycle management
    const args = enable
      ? ["plugins", "enable", id]
      : ["plugins", "disable", id];

    const result = await runOpenClaw(args);
    pushLog("info", "system", `Plugin「${id}」${enable ? "enable" : "disable"}: code=${result.code} stdout=${result.stdout}`);

    if (result.code !== 0) {
      // Fallback: write config directly
      const config = readOpenClawConfig();
      if (!config.plugins) config.plugins = {};
      const plugins = config.plugins as Record<string, unknown>;
      if (!plugins.entries) plugins.entries = {};
      const entries = plugins.entries as Record<string, { enabled?: boolean }>;
      if (!entries[id]) entries[id] = {};
      entries[id].enabled = enable;
      writeOpenClawConfig(config);
      pushLog("info", "system", `Plugin「${id}」fallback config write`);
    }

    return { success: true };
  } catch (err) {
    pushLog("error", "system", `切换 Plugin 失败: ${err}`);
    return { success: false, error: String(err) };
  }
}
