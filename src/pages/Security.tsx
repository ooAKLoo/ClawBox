import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SecurityConfig, PromptScanResult, AssistantConfig } from "../types/global";
import Term from "../components/Glossary";
import Dialog from "../components/Dialog";
import SecurityParticles from "../components/SecurityParticles";

const defaults: SecurityConfig = {
  blockPublicExpose: true,
  blockShellAccess: true,
  blockFullDiskAccess: true,
  encryptCredentials: true,
  groupChatEnabled: false,
  groupChatWhitelist: [],
  promptScanEnabled: true,
};

type BooleanKey = {
  [K in keyof SecurityConfig]: SecurityConfig[K] extends boolean ? K : never;
}[keyof SecurityConfig];

type PolicyItem = {
  key: BooleanKey;
  title: ReactNode;
  desc: ReactNode;
  risk: "critical" | "high" | "medium";
};

const policyGroups: { label: string; items: PolicyItem[] }[] = [
  {
    label: "网络防护",
    items: [
      { key: "blockPublicExpose", title: "禁止公网暴露", desc: <><Term k="Gateway" /> 仅监听 127.0.0.1，不对外开放端口</>, risk: "critical" },
    ],
  },
  {
    label: "权限隔离",
    items: [
      { key: "blockShellAccess", title: <span>禁止 <Term k="Shell" /> 执行</span>, desc: "不允许助手执行任意系统命令", risk: "critical" },
      { key: "blockFullDiskAccess", title: "禁止全盘文件访问", desc: "限制文件读写范围到指定工作目录", risk: "high" },
    ],
  },
  {
    label: "数据安全",
    items: [
      { key: "encryptCredentials", title: "凭证加密存储", desc: "API Key / App Secret 使用系统钥匙串加密，磁盘上不存明文", risk: "critical" },
    ],
  },
  {
    label: "通信管控",
    items: [
      { key: "groupChatEnabled", title: <span>启用<Term k="群聊">群聊</Term></span>, desc: "默认仅私聊可用；开启后允许白名单群内 @机器人，群内任何成员均可触发响应", risk: "medium" },
      { key: "promptScanEnabled", title: <><Term k="Prompt">Prompt</Term> 注入扫描</>, desc: "自动检测助手提示词中的注入攻击与信息泄露风险", risk: "high" },
    ],
  },
];

const allItems = policyGroups.flatMap((g) => g.items);

function ShieldScore({ score, total, daemonRunning }: { score: number; total: number; daemonRunning: boolean }) {
  const pct = score / total;
  const color: [number, number, number] = !daemonRunning
    ? [163, 163, 163] // neutral-400 — inactive
    : pct === 1
      ? [16, 185, 129] // emerald-500
      : pct >= 0.75
        ? [245, 158, 11] // amber-500
        : [239, 68, 68]; // red-500
  const hexColor = `rgb(${color[0]},${color[1]},${color[2]})`;
  const label = !daemonRunning ? "未启动" : pct === 1 ? "全部启用" : pct >= 0.75 ? "基本安全" : "存在风险";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[92px] h-[92px]">
        {/* Particle sphere — only animate when daemon is running */}
        {daemonRunning ? (
          <SecurityParticles size={92} sphereRadius={38} color={color} />
        ) : (
          <div className="w-[92px] h-[92px] flex items-center justify-center">
            <div className="w-[60px] h-[60px] rounded-full bg-neutral-200/50" />
          </div>
        )}
        {/* Score overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-[20px] font-semibold tabular-nums leading-none"
            style={{ color: daemonRunning ? "rgb(64,64,64)" : "rgb(163,163,163)" }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {score}
          </motion.span>
          <span className="text-[8px] text-neutral-400 mt-0.5">/ {total}</span>
        </div>
      </div>
      <motion.div
        className="mt-2 flex items-center gap-1.5"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hexColor }} />
        <span className="text-[10px] font-medium text-neutral-500">{label}</span>
      </motion.div>
    </div>
  );
}

function RiskTag({ risk, active }: { risk: "critical" | "high" | "medium"; active: boolean }) {
  if (active) return null;

  const config = {
    critical: { label: "严重风险", bg: "bg-[#FFF1F2]", text: "text-[#E11D48]" },
    high: { label: "高风险", bg: "bg-[#FFFBEB]", text: "text-[#D97706]" },
    medium: { label: "注意", bg: "bg-neutral-100", text: "text-neutral-500" },
  }[risk];

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${config.bg} ${config.text}`}
    >
      {config.label}
    </motion.span>
  );
}

export default function Security() {
  const [config, setConfig] = useState<SecurityConfig>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<{ assistant: AssistantConfig; result: PromptScanResult }[]>([]);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [daemonRunning, setDaemonRunning] = useState(false);

  // Load config and daemon status on mount
  useEffect(() => {
    (async () => {
      try {
        const [data, status] = await Promise.all([
          window.clawbox?.getSecurityConfig(),
          window.clawbox?.getDaemonStatus(),
        ]);
        if (data) setConfig(data);
        if (status) setDaemonRunning(status.running);
      } catch { /* */ }
      setLoaded(true);
    })();
  }, []);

  // Auto-save with debounce (skip initial load)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.clawbox?.saveSecurityConfig(config);
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [config, loaded]);

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

  useEffect(() => {
    if (!config.promptScanEnabled) {
      setScanResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setScanning(true);
      setScanResults([]);
      try {
        const assistants = await window.clawbox?.listAssistants();
        if (!assistants?.length || cancelled) { setScanning(false); return; }
        const results: { assistant: AssistantConfig; result: PromptScanResult }[] = [];
        for (const ast of assistants) {
          if (cancelled) break;
          const result = await window.clawbox?.scanPrompt(ast.systemPrompt);
          if (result) results.push({ assistant: ast, result });
        }
        if (!cancelled) setScanResults(results);
      } catch { /* */ }
      if (!cancelled) setScanning(false);
    })();
    return () => { cancelled = true; };
  }, [config.promptScanEnabled]);

  // Score
  const isItemActive = (item: PolicyItem) => {
    if (item.key === "groupChatEnabled") return !config[item.key];
    return config[item.key];
  };
  const safeCount = allItems.filter(isItemActive).length;
  const totalChecks = allItems.length;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[14px] font-medium text-neutral-700">安全</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            管理权限策略与 <Term k="Prompt">Prompt</Term> 注入检测
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={resetDefaults}
          className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition-colors duration-200"
        >
          恢复默认
        </motion.button>
      </div>

      {/* Score hero */}
      <div className="bg-neutral-100 rounded-2xl p-5 mb-3 flex items-center gap-6">
        <ShieldScore score={safeCount} total={totalChecks} daemonRunning={daemonRunning} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-neutral-700 mb-1">防护评分</div>
          <div className="text-[10px] text-neutral-400 leading-relaxed">
            {!daemonRunning
              ? "Gateway 未启动，安全策略暂未生效。请先在控制台启动 Gateway。"
              : safeCount === totalChecks
                ? "所有安全策略已启用，你的助手运行在最高防护等级下。"
                : safeCount >= totalChecks - 2
                  ? "大部分安全策略已启用，建议检查未启用的项目以获得完整防护。"
                  : "多项关键安全策略未启用，你的助手存在被攻击的风险。请立即检查并修复。"
            }
          </div>
          {daemonRunning && safeCount < totalChecks && (
            <div className="mt-2 flex flex-wrap gap-1">
              {allItems.filter((item) => !isItemActive(item)).map((item) => (
                <span
                  key={item.key}
                  className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${
                    item.risk === "critical" ? "bg-[#FFF1F2] text-[#E11D48]" :
                    item.risk === "high" ? "bg-[#FFFBEB] text-[#D97706]" :
                    "bg-neutral-200 text-neutral-500"
                  }`}
                >
                  {typeof item.title === "string" ? item.title : item.key}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Grouped security policies */}
        {policyGroups.map((group) => (
          <div key={group.label} className="bg-neutral-100 rounded-2xl p-4">
            <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
              {group.label}
            </div>
            <div className="space-y-2">
              {group.items.map((item) => {
                const active = isItemActive(item);
                const isPromptScan = item.key === "promptScanEnabled";

                // Scan status badge for promptScanEnabled row
                const scanBadge = isPromptScan && config.promptScanEnabled ? (
                  scanning ? (
                    <span className="inline-flex items-center gap-1 text-[8px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-400">
                      <motion.span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ border: "1.5px solid #D4D4D4", borderTopColor: "#737373" }}
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                      />
                      扫描中
                    </span>
                  ) : scanResults.length > 0 ? (
                    scanResults.some((r) => r.result.level !== "safe") ? (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setScanDialogOpen(true)}
                        className="inline-flex items-center gap-1 text-[8px] font-medium px-1.5 py-0.5 rounded bg-[#FFFBEB] text-[#D97706] cursor-pointer"
                      >
                        <span className="w-1 h-1 rounded-full bg-amber-400" />
                        {scanResults.filter((r) => r.result.level !== "safe").length} 项风险
                      </motion.button>
                    ) : (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-1 text-[8px] font-medium px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#059669]"
                      >
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        全部安全
                      </motion.span>
                    )
                  ) : null
                ) : null;

                return (
                  <div key={item.key} className="bg-white rounded-xl p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-1 rounded-full flex-shrink-0 transition-colors duration-300 ${
                          active ? "bg-emerald-500" : item.risk === "critical" ? "bg-red-400" : item.risk === "high" ? "bg-amber-400" : "bg-neutral-300"
                        }`} />
                        <span className="text-[11px] font-medium text-neutral-700">{item.title}</span>
                        <AnimatePresence>
                          <RiskTag risk={item.risk} active={active} />
                        </AnimatePresence>
                        {scanBadge}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5 ml-3">{item.desc}</div>
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
                );
              })}
            </div>
          </div>
        ))}

        {/* Group chat whitelist */}
        <AnimatePresence>
          {config.groupChatEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="bg-neutral-100 rounded-2xl p-4">
                <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
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
                          className="text-[10px] text-neutral-400 hover:text-red-400 transition-colors duration-200"
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scan results dialog */}
      <Dialog open={scanDialogOpen} onClose={() => setScanDialogOpen(false)} title="Prompt 扫描结果">
        <div className="space-y-1.5">
          {scanResults.map(({ assistant, result }) => (
            <div key={assistant.id} className="bg-neutral-50 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px]">{assistant.icon}</span>
                  <span className="text-[10px] font-medium text-neutral-600">{assistant.name}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    result.level === "safe"
                      ? "bg-emerald-500"
                      : result.level === "medium"
                        ? "bg-amber-400"
                        : "bg-red-400"
                  }`} />
                  <span className={`text-[9px] font-medium ${
                    result.level === "safe"
                      ? "text-emerald-600"
                      : result.level === "medium"
                        ? "text-amber-600"
                        : "text-red-500"
                  }`}>
                    {result.level === "safe" && "安全"}
                    {result.level === "medium" && "中危"}
                    {result.level === "high" && "高危"}
                  </span>
                </div>
              </div>
              {result.matched.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {result.matched.map((m, i) => (
                    <div key={i} className="text-[9px] text-neutral-400 font-mono bg-white rounded-lg px-2 py-1">{m}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
