import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Term from "../components/Glossary";
import type { SkillInfo, PluginInfo, MemoryStatus, MemorySearchResult } from "../types/global";

// ── 中文友好名称 & 描述 ──

const SKILL_ZH: Record<string, { name: string; desc: string }> = {
  "1password":        { name: "1Password",        desc: "读取和管理 1Password 密码库中的凭证" },
  "apple-notes":      { name: "Apple 备忘录",     desc: "读写 macOS 系统备忘录" },
  "apple-reminders":  { name: "Apple 提醒事项",   desc: "创建和管理 macOS 提醒事项" },
  "bear-notes":       { name: "Bear 笔记",        desc: "管理 Bear 笔记应用中的内容" },
  "blogwatcher":      { name: "博客订阅",          desc: "对话中让 AI 帮你查看已订阅博客的最新文章，需装 blogwatcher CLI" },
  "blucli":           { name: "蓝牙管理",          desc: "控制 macOS 蓝牙设备连接" },
  "bluebubbles":      { name: "BlueBubbles",      desc: "通过 BlueBubbles 收发 iMessage 消息" },
  "camsnap":          { name: "网络摄像头",        desc: "对话中让 AI 从 RTSP/ONVIF 摄像头抓取画面" },
  "canvas":           { name: "画布",              desc: "生成和编辑图片、图表" },
  "clawhub":          { name: "ClawHub 市场",      desc: "从 ClawHub 浏览和安装社区扩展" },
  "coding-agent":     { name: "编程助手",          desc: "启动独立的编程 Agent 处理复杂开发任务" },
  "discord":          { name: "Discord",           desc: "在 Discord 频道中收发消息" },
  "eightctl":         { name: "8Sleep 床垫",       desc: "控制 8Sleep 智能床垫温度" },
  "gemini":           { name: "Gemini 搜索",       desc: "调用 Google Gemini 进行联网搜索" },
  "gh-issues":        { name: "GitHub Issues",     desc: "创建、查看和管理 GitHub 仓库的 Issue" },
  "gifgrep":          { name: "GIF 搜索",          desc: "对话中让 AI 搜索 GIF 动图并下载" },
  "github":           { name: "GitHub",            desc: "操作 GitHub 仓库、PR、代码审查" },
  "gog":              { name: "Google 搜索",       desc: "执行 Google 搜索并返回结果" },
  "goplaces":         { name: "地点搜索",          desc: "对话中让 AI 查询 Google 地图上的地点信息，需 API Key" },
  "healthcheck":      { name: "主机安全审计",      desc: "对话中让 AI 检查运行环境的安全配置和加固建议" },
  "himalaya":         { name: "邮件",              desc: "收发电子邮件（IMAP/SMTP）" },
  "imsg":             { name: "iMessage",          desc: "收发 iMessage / 短信（仅 Mac）" },
  "mcporter":         { name: "MCP 桥接",          desc: "将 MCP Server 工具桥接到 OpenClaw" },
  "model-usage":      { name: "用量统计",          desc: "查看各模型的 Token 消耗统计" },
  "nano-banana-pro":  { name: "Nano Banana",       desc: "在本地设备上运行图片生成模型" },
  "nano-pdf":         { name: "PDF 编辑",          desc: "用自然语言编辑 PDF 文件" },
  "notion":           { name: "Notion",            desc: "读写 Notion 页面和数据库" },
  "obsidian":         { name: "Obsidian",          desc: "管理 Obsidian 笔记库中的文档" },
  "openai-image-gen": { name: "AI 绘图",           desc: "调用 OpenAI DALL·E 生成图片" },
  "openai-whisper":   { name: "语音转文字（本地）", desc: "用 Whisper 本地模型将音频转为文字" },
  "openai-whisper-api":{ name: "语音转文字（API）", desc: "调用 OpenAI Whisper API 转录音频" },
  "openhue":          { name: "Hue 灯光",          desc: "控制 Philips Hue 智能灯光" },
  "oracle":           { name: "Oracle DB",         desc: "查询 Oracle 数据库" },
  "ordercli":         { name: "订单管理",          desc: "查看和管理电商订单" },
  "peekaboo":         { name: "屏幕截图",          desc: "对话中让 AI 截取 Mac 屏幕画面并分析内容" },
  "sag":              { name: "Shell Agent",       desc: "在受控沙箱中执行 Shell 命令" },
  "session-logs":     { name: "会话日志",          desc: "查看和导出历史对话记录" },
  "sherpa-onnx-tts":  { name: "文字转语音（本地）",desc: "使用本地 TTS 模型朗读文字" },
  "skill-creator":    { name: "Skill 创建器",      desc: "引导你创建自定义 Skill 扩展" },
  "slack":            { name: "Slack",             desc: "在 Slack 工作区中收发消息" },
  "songsee":          { name: "音频可视化",        desc: "对话中让 AI 从音频文件生成频谱图和特征分析" },
  "sonoscli":         { name: "Sonos 音响",        desc: "控制 Sonos 音响播放" },
  "spotify-player":   { name: "Spotify 播放器",    desc: "对话中让 AI 帮你播放、暂停、搜索 Spotify 歌曲" },
  "summarize":        { name: "内容摘要",          desc: "对话中让 AI 总结网页、播客、视频或本地文件的内容" },
  "things-mac":       { name: "Things 待办",       desc: "管理 Things 3 中的任务和项目" },
  "tmux":             { name: "Tmux 终端",         desc: "管理 tmux 终端会话" },
  "trello":           { name: "Trello 看板",       desc: "管理 Trello 卡片和看板" },
  "video-frames":     { name: "视频帧提取",        desc: "对话中让 AI 从视频文件提取关键帧进行分析，需装 ffmpeg" },
  "voice-call":       { name: "语音通话",          desc: "拨打和接听电话（需配置运营商）" },
  "wacli":            { name: "WhatsApp",          desc: "通过 CLI 收发 WhatsApp 消息" },
  "weather":          { name: "天气查询",          desc: "对话中问 AI「今天天气怎么样」即可获取实时天气，无需 API Key" },
  "xurl":             { name: "X (Twitter)",       desc: "对话中让 AI 发推、回复、搜索、管理 X 账号" },
};

const PLUGIN_ZH: Record<string, { name: string; desc: string }> = {
  "acpx":                    { name: "Claude Code 代理",  desc: "让 OpenClaw 调用 Claude Code 执行编程任务" },
  "bluebubbles":             { name: "BlueBubbles",       desc: "通过 BlueBubbles 服务收发 iMessage" },
  "copilot-proxy":           { name: "Copilot 代理",      desc: "将 GitHub Copilot 令牌桥接给 OpenClaw 使用" },
  "device-pair":             { name: "设备配对",           desc: "将手机等设备与 OpenClaw 配对连接" },
  "diagnostics-otel":        { name: "诊断监控",           desc: "将运行指标发送到 OpenTelemetry 后端" },
  "diffs":                   { name: "差异对比",           desc: "对比文件变更，显示详细差异" },
  "discord":                 { name: "Discord",           desc: "接入 Discord 机器人，在频道中自动回复" },
  "feishu":                  { name: "飞书",              desc: "接入飞书机器人，在群聊中自动回复" },
  "google-antigravity-auth": { name: "Google AI 认证",    desc: "用 Google 账号认证 Gemini API，启用后需 CLI 登录" },
  "google-gemini-cli-auth":  { name: "Gemini CLI 认证",   desc: "借用 Gemini CLI 凭证调用模型，非官方集成，有账号风险" },
  "googlechat":              { name: "Google Chat",       desc: "接入 Google Chat 空间自动回复" },
  "imessage":                { name: "iMessage",          desc: "直接收发 Mac 上的 iMessage 消息" },
  "irc":                     { name: "IRC",               desc: "连接 IRC 频道进行自动回复" },
  "line":                    { name: "LINE",              desc: "接入 LINE 官方账号自动回复" },
  "llm-task":                { name: "LLM 子任务",        desc: "将复杂任务拆解为多个 LLM 子调用" },
  "lobster":                 { name: "Lobster",           desc: "在 lobste.rs 技术社区浏览和互动" },
  "matrix":                  { name: "Matrix",            desc: "接入 Matrix/Element 聊天室自动回复" },
  "mattermost":              { name: "Mattermost",        desc: "接入 Mattermost 团队通讯自动回复" },
  "memory-core":             { name: "内置记忆",           desc: "使用 OpenClaw 内置引擎存储对话记忆" },
  "memory-lancedb":          { name: "LanceDB 记忆",      desc: "用 LanceDB 向量数据库实现长期记忆" },
  "minimax-portal-auth":     { name: "MiniMax 认证",      desc: "OAuth 登录 MiniMax，启用后需 CLI 认证才能使用" },
  "msteams":                 { name: "Microsoft Teams",   desc: "接入 Teams 频道自动回复" },
  "nextcloud-talk":          { name: "Nextcloud Talk",    desc: "接入 Nextcloud Talk 聊天自动回复" },
  "nostr":                   { name: "Nostr",             desc: "连接 Nostr 去中心化社交网络" },
  "open-prose":              { name: "写作优化",           desc: "优化文本表达，提升写作质量" },
  "phone-control":           { name: "手机控制",           desc: "远程控制手机执行操作" },
  "qwen-portal-auth":        { name: "通义千问认证",       desc: "OAuth 登录通义千问，启用后需 CLI 认证才能使用" },
  "shared":                  { name: "公共工具库",         desc: "其他插件共用的基础工具集" },
  "signal":                  { name: "Signal",            desc: "接入 Signal 加密通讯自动回复" },
  "slack":                   { name: "Slack",             desc: "接入 Slack 工作区机器人自动回复" },
  "synology-chat":           { name: "群晖 Chat",         desc: "接入群晖 Synology Chat 自动回复" },
  "talk-voice":              { name: "语音对话",           desc: "实现语音输入和语音回复" },
  "telegram":                { name: "Telegram",          desc: "接入 Telegram 机器人自动回复" },
  "test-utils":              { name: "测试工具",           desc: "供开发者测试插件用的工具集" },
  "thread-ownership":        { name: "对话归属",           desc: "在群聊中追踪和管理各对话线程" },
  "tlon":                    { name: "Tlon",              desc: "连接 Tlon/Urbit 网络" },
  "twitch":                  { name: "Twitch",            desc: "接入 Twitch 直播间自动互动" },
  "voice-call":              { name: "语音通话",           desc: "拨打和接听语音电话" },
  "whatsapp":                { name: "WhatsApp",          desc: "接入 WhatsApp 自动回复消息" },
  "zalo":                    { name: "Zalo 官方号",       desc: "接入 Zalo 官方账号自动回复" },
  "zalouser":                { name: "Zalo 个人号",       desc: "用个人 Zalo 账号收发消息" },
};

// ── Plugin kind labels & colors ──

const KIND_META: Record<string, { label: string; color: string; bg: string }> = {
  channel: { label: "通道", color: "text-[#2563EB]", bg: "bg-[#EFF6FF]" },
  memory:  { label: "记忆", color: "text-[#7C3AED]", bg: "bg-[#FAF5FF]" },
  provider:{ label: "认证", color: "text-[#059669]", bg: "bg-[#ECFDF5]" },
};

// ── 启用后提示（需要额外步骤的插件） ──

const POST_ENABLE_HINTS: Record<string, { title: string; steps: string[] }> = {
  "minimax-portal-auth": {
    title: "MiniMax 认证：还需完成登录",
    steps: [
      "重启 Gateway（在「状态」面板中重启）",
      "打开终端，运行：openclaw models auth login --provider minimax-portal --set-default",
      "在弹出的页面中登录 MiniMax 账号",
      "仅支持 Coding 计划的免费额度",
    ],
  },
  "google-gemini-cli-auth": {
    title: "Gemini CLI 认证：还需完成登录",
    steps: [
      "先安装 Gemini CLI：brew install gemini-cli",
      "重启 Gateway",
      "运行：openclaw models auth login --provider google-gemini-cli --set-default",
      "⚠️ 非官方集成，有账号风险，勿使用主力 Google 账号",
    ],
  },
  "google-antigravity-auth": {
    title: "Google AI 认证：还需完成登录",
    steps: [
      "重启 Gateway",
      "运行：openclaw models auth login --provider google-antigravity --set-default",
      "在浏览器中完成 Google 账号授权",
    ],
  },
  "qwen-portal-auth": {
    title: "通义千问认证：还需完成登录",
    steps: [
      "重启 Gateway",
      "运行：openclaw models auth login --provider qwen-portal --set-default",
      "按提示完成设备码登录",
    ],
  },
  "telegram": {
    title: "Telegram：还需配置 Bot Token",
    steps: [
      "在 Telegram 中找 @BotFather 创建机器人，获取 Token",
      "运行：openclaw channels login telegram",
      "重启 Gateway 后生效",
    ],
  },
  "discord": {
    title: "Discord：还需配置 Bot",
    steps: [
      "在 Discord Developer Portal 创建应用并获取 Bot Token",
      "运行：openclaw channels login discord",
      "重启 Gateway 后生效",
    ],
  },
  "slack": {
    title: "Slack：还需配置应用",
    steps: [
      "在 Slack API 创建应用，获取 Bot Token",
      "运行：openclaw channels login slack",
      "重启 Gateway 后生效",
    ],
  },
  "memory-lancedb": {
    title: "LanceDB 记忆：还需配置 Embedding",
    steps: [
      "需要一个 Embedding 模型的 API Key（如 OpenAI）",
      "在 ~/.openclaw/openclaw.json 中配置 plugins.entries.memory-lancedb.config.embedding",
      "设置 plugins.slots.memory 为 \"memory-lancedb\"",
      "重启 Gateway 后生效",
    ],
  },
};

type Tab = "skills" | "plugins";

export default function ExtensionsSection() {
  const [tab, setTab] = useState<Tab>("skills");
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hint, setHint] = useState<{ title: string; steps: string[] } | null>(null);
  const [memoryModal, setMemoryModal] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus | null>(null);
  const [memoryContent, setMemoryContent] = useState<string | null>(null);
  const [memoryActiveFile, setMemoryActiveFile] = useState<string | null>(null);
  const [memorySearchQuery, setMemorySearchQuery] = useState("");
  const [memorySearchResults, setMemorySearchResults] = useState<MemorySearchResult[] | null>(null);
  const [memorySearching, setMemorySearching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [sk, pl] = await Promise.all([
          window.clawbox?.listSkills(),
          window.clawbox?.listPlugins(),
        ]);
        if (sk) setSkills(sk);
        if (pl) setPlugins(pl);
      } catch { /* */ }
      setLoading(false);
    })();
  }, []);

  const handleToggleSkill = async (name: string, enable: boolean) => {
    setTogglingId(name);
    const result = await window.clawbox?.toggleSkill(name, enable);
    if (result?.success) {
      setSkills((prev) => prev.map((s) => s.name === name ? { ...s, enabled: enable } : s));
    }
    setTogglingId(null);
  };

  const handleTogglePlugin = async (id: string, enable: boolean) => {
    setTogglingId(id);
    const result = await window.clawbox?.togglePlugin(id, enable);
    if (result?.success) {
      setPlugins((prev) => prev.map((p) => p.id === id ? { ...p, enabled: enable } : p));
      if (enable && POST_ENABLE_HINTS[id]) {
        setHint(POST_ENABLE_HINTS[id]);
      }
    }
    setTogglingId(null);
  };

  const openMemoryModal = async () => {
    setMemoryModal(true);
    setMemoryContent(null);
    setMemoryActiveFile(null);
    setMemorySearchResults(null);
    setMemorySearchQuery("");
    const status = await window.clawbox?.getMemoryStatus();
    if (status) setMemoryStatus(status);
    // Auto-load the main MEMORY.md if it exists
    if (status?.files.length) {
      const mainFile = status.files.find((f) => f.path === "MEMORY.md") || status.files[0];
      loadMemoryFile(mainFile.path);
    }
  };

  const loadMemoryFile = async (filePath: string) => {
    setMemoryActiveFile(filePath);
    setMemoryContent(null);
    setMemorySearchResults(null);
    const result = await window.clawbox?.readMemoryFile(filePath);
    if (result?.success && result.content != null) {
      setMemoryContent(result.content);
    } else {
      setMemoryContent("无法读取文件");
    }
  };

  const handleMemorySearch = async () => {
    if (!memorySearchQuery.trim()) return;
    setMemorySearching(true);
    setMemoryContent(null);
    setMemoryActiveFile(null);
    const result = await window.clawbox?.searchMemory(memorySearchQuery);
    if (result?.success && result.results) {
      setMemorySearchResults(result.results);
    } else {
      setMemorySearchResults([]);
    }
    setMemorySearching(false);
  };

  const handleShowInstall = (skill: SkillInfo) => {
    const zh = SKILL_ZH[skill.name];
    const displayName = zh?.name || skill.name;
    const steps: string[] = [];

    if (skill.install.length > 0) {
      // Pick the best installer for macOS: prefer brew, then others
      const brewInstaller = skill.install.find((i) => i.kind === "brew");
      const preferred = brewInstaller || skill.install[0];
      steps.push(`打开终端，运行：${preferred.command}`);
      // Show alternatives if more than one
      const others = skill.install.filter((i) => i !== preferred);
      if (others.length > 0) {
        steps.push(`其他安装方式：${others.map((i) => i.command).join(" 或 ")}`);
      }
    } else if (skill.requires.bins.length > 0) {
      steps.push(`需要安装命令行工具：${skill.requires.bins.join(", ")}`);
    }

    if (skill.requires.env.length > 0) {
      steps.push(`还需配置环境变量：${skill.requires.env.join(", ")}`);
    }

    steps.push("安装完成后回到此页面，刷新即可启用");

    if (skill.homepage) {
      steps.push(`详细文档：${skill.homepage}`);
    }

    setHint({
      title: `${displayName}：需要安装依赖`,
      steps,
    });
  };

  // ── Filtered lists ──

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const q = searchQuery.toLowerCase();
    return skills.filter((s) => {
      const zh = SKILL_ZH[s.name];
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) ||
        (zh && (zh.name.toLowerCase().includes(q) || zh.desc.includes(q)));
    });
  }, [skills, searchQuery]);

  const filteredPlugins = useMemo(() => {
    if (!searchQuery.trim()) return plugins;
    const q = searchQuery.toLowerCase();
    return plugins.filter((p) => {
      const zh = PLUGIN_ZH[p.id];
      return p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) ||
        p.channels.some((c) => c.toLowerCase().includes(q)) ||
        (zh && (zh.name.toLowerCase().includes(q) || zh.desc.includes(q)));
    });
  }, [plugins, searchQuery]);

  // ── Stats ──

  const enabledSkills = skills.filter((s) => s.enabled).length;
  const enabledPlugins = plugins.filter((p) => p.enabled).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-3">
        <div className="text-[11px] font-medium text-neutral-700">扩展</div>
        <div className="text-[10px] text-neutral-400 mt-0.5">
          {loading ? "加载中..." : <>{enabledSkills} 个 <Term k="Skill" /> 启用 · {enabledPlugins} 个 <Term k="Plugin" /> 启用 · 共 {skills.length + plugins.length} 个</>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 bg-neutral-200 rounded-lg p-0.5 mb-3">
        {(["skills", "plugins"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearchQuery(""); }}
            className="relative flex-1 py-1.5 text-[10px] font-medium rounded-md z-[1]"
          >
            {tab === t && (
              <motion.div
                layoutId="extensions-tab-indicator"
                className="absolute inset-0 bg-white rounded-md"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className={`relative z-[1] transition-colors duration-200 ${tab === t ? "text-neutral-800" : "text-neutral-400"}`}>
              {t === "skills" ? `Skills (${skills.length})` : `Plugins (${plugins.length})`}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={tab === "skills" ? "搜索 Skill..." : "搜索 Plugin..."}
        className="w-full bg-neutral-100 rounded-xl px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300 mb-3"
      />

      {/* Content */}
      {loading ? (
        <div className="text-[10px] text-neutral-400 text-center py-8">正在读取 OpenClaw 扩展...</div>
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          {tab === "skills" ? (
            <motion.div
              key="skills"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <SkillsList
                skills={filteredSkills}
                togglingId={togglingId}
                onToggle={handleToggleSkill}
                onShowInstall={handleShowInstall}
              />
            </motion.div>
          ) : (
            <motion.div
              key="plugins"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <PluginsList
                plugins={filteredPlugins}
                togglingId={togglingId}
                onToggle={handleTogglePlugin}
                onMemoryClick={openMemoryModal}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Post-enable hint dialog */}
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
            onClick={() => setHint(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-3xl w-[420px] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[13px] font-medium text-neutral-700 mb-1">{hint.title}</div>
              <p className="text-[10px] text-neutral-400 mb-4">还需要以下步骤才能使用：</p>
              <div className="bg-[#FFFBEB] rounded-2xl px-4 py-3.5 mb-4">
                <ol className="text-[10px] text-amber-700 space-y-1.5 list-decimal list-inside">
                  {hint.steps.map((step, i) => {
                    // Steps with command to highlight
                    const cmdPrefixes = ["运行：", "打开终端，运行：", "其他安装方式：", "还需配置环境变量：", "需要安装命令行工具："];
                    const matchedPrefix = cmdPrefixes.find((p) => step.startsWith(p));
                    if (matchedPrefix) {
                      const rest = step.slice(matchedPrefix.length);
                      return (
                        <li key={i}>
                          {matchedPrefix}
                          <code className="text-[9px] bg-white rounded px-1.5 py-0.5 font-mono text-amber-800 select-all">
                            {rest}
                          </code>
                        </li>
                      );
                    }
                    if (step.startsWith("详细文档：")) {
                      return (
                        <li key={i}>
                          详细文档：
                          <span className="text-[9px] text-amber-600 underline select-all">{step.slice(5)}</span>
                        </li>
                      );
                    }
                    return (
                      <li key={i} className={step.startsWith("⚠️") ? "font-medium text-[#E11D48]" : ""}>
                        {step}
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="flex justify-end">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setHint(null)}
                  className="text-[10px] font-medium px-4 py-2 rounded-lg bg-neutral-800 text-white"
                >
                  知道了
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memory modal */}
      <AnimatePresence>
        {memoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
            onClick={() => setMemoryModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-3xl w-[560px] max-h-[80vh] flex flex-col p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[13px] font-medium text-neutral-700">记忆存储</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    {memoryStatus ? `${memoryStatus.backend} 引擎 · ${memoryStatus.files.length} 个文件` : "加载中..."}
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMemoryModal(false)} className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-400 hover:bg-neutral-200">
                  关闭
                </motion.button>
              </div>

              {/* Search */}
              <div className="flex gap-2 mb-3">
                <input
                  value={memorySearchQuery}
                  onChange={(e) => setMemorySearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleMemorySearch()}
                  placeholder="语义搜索记忆..."
                  className="flex-1 bg-neutral-100 rounded-xl px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleMemorySearch}
                  disabled={memorySearching || !memorySearchQuery.trim()}
                  className={`text-[10px] font-medium px-3 py-2 rounded-xl ${memorySearchQuery.trim() && !memorySearching ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-300"}`}
                >
                  {memorySearching ? "搜索中..." : "搜索"}
                </motion.button>
              </div>

              {/* File tabs */}
              {memoryStatus && memoryStatus.files.length > 0 && !memorySearchResults && (
                <div className="flex gap-1 mb-3 overflow-x-auto">
                  {memoryStatus.files.map((f) => (
                    <motion.button
                      key={f.path}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => loadMemoryFile(f.path)}
                      className={`text-[9px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors duration-200 ${
                        memoryActiveFile === f.path ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      }`}
                    >
                      {f.path === "MEMORY.md" ? "长期记忆" : f.path.replace("memory/", "").replace(".md", "")}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Content area */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {memorySearchResults !== null ? (
                  // Search results
                  <div className="space-y-2">
                    {memorySearchResults.length === 0 ? (
                      <div className="text-[10px] text-neutral-400 text-center py-6">没有找到相关记忆</div>
                    ) : (
                      <>
                        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
                          搜索结果 · {memorySearchResults.length} 条
                        </div>
                        {memorySearchResults.map((r, i) => (
                          <div key={i} className="bg-neutral-100 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] text-neutral-400">{r.path}</span>
                              <span className="text-[8px] text-neutral-300">{(r.score * 100).toFixed(0)}% 匹配</span>
                            </div>
                            <p className="text-[10px] text-neutral-600 leading-4 whitespace-pre-wrap">{r.snippet}</p>
                          </div>
                        ))}
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setMemorySearchResults(null); setMemorySearchQuery(""); }}
                          className="text-[9px] font-medium text-neutral-400 hover:text-neutral-600 mt-1"
                        >
                          ← 返回文件列表
                        </motion.button>
                      </>
                    )}
                  </div>
                ) : memoryContent !== null ? (
                  // File content
                  <div className="bg-neutral-100 rounded-2xl p-4">
                    <pre className="text-[10px] text-neutral-600 leading-4 whitespace-pre-wrap font-sans">{memoryContent || "（空文件）"}</pre>
                  </div>
                ) : memoryStatus && memoryStatus.files.length === 0 ? (
                  <div className="text-[10px] text-neutral-400 text-center py-8">
                    <p className="mb-1">还没有记忆数据</p>
                    <p className="text-[9px] text-neutral-300">AI 在对话中会自动记住重要信息，这些记忆会出现在这里</p>
                  </div>
                ) : (
                  <div className="text-[10px] text-neutral-400 text-center py-6">加载中...</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Skills List ──

function SkillsList({ skills, togglingId, onToggle, onShowInstall }: {
  skills: SkillInfo[];
  togglingId: string | null;
  onToggle: (name: string, enable: boolean) => void;
  onShowInstall: (skill: SkillInfo) => void;
}) {
  if (skills.length === 0) {
    return <div className="text-[10px] text-neutral-400 text-center py-6">没有找到 Skill</div>;
  }

  // Group: enabled first, then eligible, then unavailable
  const enabled = skills.filter((s) => s.enabled);
  const available = skills.filter((s) => !s.enabled && s.eligible);
  const unavailable = skills.filter((s) => !s.enabled && !s.eligible);

  return (
    <div className="space-y-3">
      {enabled.length > 0 && (
        <div>
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">已启用</div>
          <div className="space-y-1.5">
            {enabled.map((s) => (
              <SkillRow key={s.name} skill={s} toggling={togglingId === s.name} onToggle={onToggle} onShowInstall={onShowInstall} />
            ))}
          </div>
        </div>
      )}
      {available.length > 0 && (
        <div>
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">可用</div>
          <div className="space-y-1.5">
            {available.map((s) => (
              <SkillRow key={s.name} skill={s} toggling={togglingId === s.name} onToggle={onToggle} onShowInstall={onShowInstall} />
            ))}
          </div>
        </div>
      )}
      {unavailable.length > 0 && (
        <div>
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">需安装依赖</div>
          <div className="space-y-1.5">
            {unavailable.map((s) => (
              <SkillRow key={s.name} skill={s} toggling={togglingId === s.name} onToggle={onToggle} onShowInstall={onShowInstall} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillRow({ skill, toggling, onToggle, onShowInstall }: {
  skill: SkillInfo;
  toggling: boolean;
  onToggle: (name: string, enable: boolean) => void;
  onShowInstall: (skill: SkillInfo) => void;
}) {
  const zh = SKILL_ZH[skill.name];
  const displayName = zh?.name || skill.name;
  const displayDesc = zh?.desc || skill.description;
  const needsDeps = !skill.eligible && skill.requires.bins.length > 0;

  return (
    <div className="bg-neutral-100 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[13px] flex-shrink-0">
          {skill.emoji || "⚡"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-neutral-700 truncate">{displayName}</span>
            {zh && <span className="text-[9px] text-neutral-300 truncate">{skill.name}</span>}
          </div>
          {displayDesc && (
            <div className="text-[9px] text-neutral-400 truncate mt-0.5">{displayDesc}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {needsDeps ? (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onShowInstall(skill)}
            className="text-[9px] font-medium px-2.5 py-1 rounded-lg text-amber-600 bg-[#FFFBEB] hover:bg-amber-100"
          >
            需安装 {skill.requires.bins[0]}
          </motion.button>
        ) : (
          <motion.button
            whileTap={toggling ? undefined : { scale: 0.9 }}
            onClick={() => onToggle(skill.name, !skill.enabled)}
            disabled={toggling}
            className={`text-[9px] font-medium px-2.5 py-1 rounded-lg transition-colors duration-200 ${
              toggling ? "bg-neutral-200 text-neutral-300 cursor-not-allowed"
              : skill.enabled ? "bg-neutral-800 text-white" : "bg-white text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            {toggling ? "..." : skill.enabled ? "已启用" : "启用"}
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ── Plugins List ──

function PluginsList({ plugins, togglingId, onToggle, onMemoryClick }: {
  plugins: PluginInfo[];
  togglingId: string | null;
  onToggle: (id: string, enable: boolean) => void;
  onMemoryClick: () => void;
}) {
  if (plugins.length === 0) {
    return <div className="text-[10px] text-neutral-400 text-center py-6">没有找到 Plugin</div>;
  }

  // Group by kind
  const channels = plugins.filter((p) => p.kind === "channel" || p.channels.length > 0);
  const memory = plugins.filter((p) => p.kind === "memory");
  const others = plugins.filter((p) => p.kind !== "channel" && p.kind !== "memory" && p.channels.length === 0);

  return (
    <div className="space-y-3">
      {channels.length > 0 && (
        <PluginGroup label="通道" plugins={channels} togglingId={togglingId} onToggle={onToggle} />
      )}
      {memory.length > 0 && (
        <PluginGroup label="记忆" plugins={memory} togglingId={togglingId} onToggle={onToggle} onMemoryClick={onMemoryClick} />
      )}
      {others.length > 0 && (
        <PluginGroup label="工具" plugins={others} togglingId={togglingId} onToggle={onToggle} />
      )}
    </div>
  );
}

function PluginGroup({ label, plugins, togglingId, onToggle, onMemoryClick }: {
  label: string;
  plugins: PluginInfo[];
  togglingId: string | null;
  onToggle: (id: string, enable: boolean) => void;
  onMemoryClick?: () => void;
}) {
  return (
    <div>
      <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">{label}</div>
      <div className="space-y-1.5">
        {plugins.map((p) => (
          <PluginRow key={p.id} plugin={p} toggling={togglingId === p.id} onToggle={onToggle} onMemoryClick={onMemoryClick} />
        ))}
      </div>
    </div>
  );
}

function PluginRow({ plugin, toggling, onToggle, onMemoryClick }: {
  plugin: PluginInfo;
  toggling: boolean;
  onToggle: (id: string, enable: boolean) => void;
  onMemoryClick?: () => void;
}) {
  const zh = PLUGIN_ZH[plugin.id];
  const meta = KIND_META[plugin.kind];
  const displayName = zh?.name || plugin.id;
  const isMemory = plugin.kind === "memory";

  return (
    <div className="bg-neutral-100 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-neutral-700">{displayName}</span>
            {meta && (
              <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${meta.color} ${meta.bg}`}>
                {meta.label}
              </span>
            )}
          </div>
          {zh?.desc ? (
            <div className="text-[9px] text-neutral-400 mt-0.5">{zh.desc}</div>
          ) : plugin.channels.length > 0 ? (
            <div className="text-[9px] text-neutral-400 mt-0.5">{plugin.channels.join(", ")}</div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isMemory && plugin.enabled && onMemoryClick && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onMemoryClick}
            className="text-[9px] font-medium px-2.5 py-1 rounded-lg bg-[#FAF5FF] text-[#7C3AED] hover:bg-purple-100"
          >
            查看记忆
          </motion.button>
        )}
        <motion.button
          whileTap={toggling ? undefined : { scale: 0.9 }}
          onClick={() => onToggle(plugin.id, !plugin.enabled)}
          disabled={toggling}
          className={`text-[9px] font-medium px-2.5 py-1 rounded-lg transition-colors duration-200 ${
            toggling ? "bg-neutral-200 text-neutral-300 cursor-not-allowed"
            : plugin.enabled ? "bg-neutral-800 text-white" : "bg-white text-neutral-500 hover:bg-neutral-200"
          }`}
        >
          {toggling ? "..." : plugin.enabled ? "已启用" : "启用"}
        </motion.button>
      </div>
    </div>
  );
}
