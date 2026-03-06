import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { SecurityConfig } from "../types/global";

const defaults: SecurityConfig = {
  toolsProfile: "messaging",
  blockPublicExpose: true,
  blockShellAccess: true,
  blockFullDiskAccess: true,
  skillWhitelist: true,
  encryptCredentials: true,
  lockStableChannel: true,
  groupChatEnabled: false,
  groupChatWhitelist: [],
};

type BooleanKey = {
  [K in keyof SecurityConfig]: SecurityConfig[K] extends boolean ? K : never;
}[keyof SecurityConfig];

const toggleItems: { key: BooleanKey; title: string; desc: string; category: string }[] = [
  { key: "blockPublicExpose", title: "禁止公网暴露", desc: "Gateway 仅监听 127.0.0.1，不对外开放端口", category: "network" },
  { key: "blockShellAccess", title: "禁止 Shell 执行", desc: "不允许 Agent 执行任意系统命令", category: "exec" },
  { key: "blockFullDiskAccess", title: "禁止全盘文件访问", desc: "限制文件读写范围到指定工作目录", category: "file" },
  { key: "skillWhitelist", title: "Skill 白名单模式", desc: "仅允许内置和已审核的 Skill，不开放市场", category: "plugin" },
  { key: "encryptCredentials", title: "凭证加密存储", desc: "API Key 等敏感信息使用系统钥匙串加密", category: "credential" },
  { key: "lockStableChannel", title: "锁定 Stable 版本", desc: "仅使用稳定版本，不自动追随 beta/dev", category: "version" },
  { key: "groupChatEnabled", title: "启用群聊", desc: "允许在白名单飞书群内 @机器人 响应", category: "chat" },
];

export default function Security() {
  const [config, setConfig] = useState<SecurityConfig>(defaults);
  const [newGroup, setNewGroup] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await window.clawbox?.getSecurityConfig();
        if (data) setConfig(data);
      } catch { /* */ }
    })();
  }, []);

  const toggle = (key: BooleanKey) => {
    setConfig((c) => ({ ...c, [key]: !c[key] }));
  };

  const addGroup = () => {
    if (!newGroup.trim()) return;
    setConfig((c) => ({
      ...c,
      groupChatWhitelist: [...c.groupChatWhitelist, newGroup.trim()],
    }));
    setNewGroup("");
  };

  const removeGroup = (idx: number) => {
    setConfig((c) => ({
      ...c,
      groupChatWhitelist: c.groupChatWhitelist.filter((_, i) => i !== idx),
    }));
  };

  const resetDefaults = () => setConfig(defaults);

  const handleSave = async () => {
    try {
      await window.clawbox?.saveSecurityConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* */ }
  };

  // Score calculation
  const safeCount = toggleItems.filter((item) => {
    if (item.key === "groupChatEnabled") return !config[item.key]; // inverted — disabled = safe
    return config[item.key];
  }).length;
  const totalChecks = toggleItems.length;
  const score = Math.round((safeCount / totalChecks) * 100);
  const riskLevel = score >= 85 ? "low" : score >= 60 ? "medium" : "high";
  const riskLabels = { low: "低风险", medium: "中风险", high: "高风险" };
  const riskColors = { low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-red-500" };

  // Profile tabs
  const profiles = [
    { value: "messaging", label: "安全模式" },
    { value: "coding", label: "增强模式" },
    { value: "full", label: "高级模式" },
  ] as const;

  return (
    <div>
      <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-4">
        权限与安全
      </div>

      {/* Score overview */}
      <div className="bg-neutral-100 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${riskColors[riskLevel]} flex items-center justify-center`}>
              <span className="text-white text-[14px] font-medium">{score}</span>
            </div>
            <div>
              <div className="text-[11px] font-medium text-neutral-700">
                安全评分 — {riskLabels[riskLevel]}
              </div>
              <div className="text-[10px] text-neutral-400">
                {safeCount}/{totalChecks} 项安全策略已启用
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={resetDefaults}
              className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
            >
              恢复默认
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-800 text-white"
            >
              保存
            </motion.button>
            {saved && <span className="text-[10px] font-medium text-emerald-600 self-center">已保存</span>}
          </div>
        </div>
      </div>

      {/* Profile selector */}
      <div className="mb-4">
        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
          权限档位
        </div>
        <div className="flex gap-0.5 bg-neutral-200 rounded-lg p-0.5">
          {profiles.map((p) => (
            <button
              key={p.value}
              onClick={() => setConfig((c) => ({ ...c, toolsProfile: p.value }))}
              className="relative flex-1 py-1.5 text-[10px] font-medium rounded-md z-[1]"
            >
              {config.toolsProfile === p.value && (
                <motion.div
                  layoutId="security-profile-tab"
                  className="absolute inset-0 bg-white rounded-md"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`relative z-[1] transition-colors duration-200 ${
                config.toolsProfile === p.value ? "text-neutral-800" : "text-neutral-400"
              }`}>
                {p.label}
              </span>
            </button>
          ))}
        </div>
        {config.toolsProfile !== "messaging" && (
          <div className="mt-2 bg-[#FFFBEB] rounded-xl px-3 py-2">
            <span className="text-[10px] text-[#D97706]">
              {config.toolsProfile === "coding"
                ? "增强模式：允许有限文件访问和附件读取。建议仅在明确需要时开启。"
                : "高级模式：无权限约束。仅限开发调试用途，不建议普通用户使用。"}
            </span>
          </div>
        )}
      </div>

      {/* Toggle list */}
      <div className="bg-neutral-100 rounded-2xl p-4 space-y-2 mb-4">
        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
          安全策略
        </div>
        {toggleItems.map((item) => (
          <div key={item.key} className="bg-white rounded-xl p-3 flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-3">
              <div className="text-[11px] font-medium text-neutral-700">{item.title}</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">{item.desc}</div>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => toggle(item.key)}
              className={`w-9 h-5 rounded-full relative flex-shrink-0 transition-colors duration-200 ${
                config[item.key] ? "bg-neutral-800" : "bg-neutral-200"
              }`}
            >
              <motion.div
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full"
                animate={{ left: config[item.key] ? 18 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            </motion.button>
          </div>
        ))}
      </div>

      {/* Group chat whitelist */}
      {config.groupChatEnabled && (
        <div className="bg-neutral-100 rounded-2xl p-4">
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
            群聊白名单
          </div>
          <p className="text-[10px] text-neutral-400 mb-3">
            仅允许以下群聊中 @机器人 触发响应。群内不主动读取历史消息。
          </p>
          <div className="space-y-1 mb-3">
            {config.groupChatWhitelist.length === 0 ? (
              <div className="bg-white rounded-xl px-3 py-2">
                <span className="text-[10px] text-neutral-300">暂无白名单群聊</span>
              </div>
            ) : (
              config.groupChatWhitelist.map((g, i) => (
                <div key={i} className="bg-white rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500">{g}</span>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeGroup(i)}
                    className="text-[10px] text-neutral-400 hover:text-red-400"
                  >
                    移除
                  </motion.button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="输入群聊名称或 ID"
              className="flex-1 bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
              onKeyDown={(e) => e.key === "Enter" && addGroup()}
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={addGroup}
              className="text-[10px] font-medium px-3 py-2 rounded-lg bg-neutral-800 text-white"
            >
              添加
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
