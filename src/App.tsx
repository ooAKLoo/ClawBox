import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, ShieldCheck } from "lucide-react";
import Onboarding from "./pages/Onboarding";
import ModelDialog from "./sections/ModelSection";
import ChannelDialog from "./sections/ChannelSection";
import SecurityDialog from "./sections/SecuritySummary";
import SettingsDialog from "./components/SettingsDialog";
import SecurityParticles from "./components/SecurityParticles";
import Term from "./components/Glossary";
import type { SecurityAlert, SecurityConfig, UsageStats } from "./types/global";
import feishuIconSrc from "./assets/icons/feishu.png";
import clawboxIconSrc from "./assets/icons/clawbox.svg";

// Model icon map
import iconDeepseek from "./assets/icons/deepseek.svg";
import iconQwen from "./assets/icons/qwen.svg";
import iconVolcengine from "./assets/icons/volcengine.svg";
import iconSiliconflow from "./assets/icons/siliconflow.svg";
import iconHunyuan from "./assets/icons/hunyuan.svg";
import iconMinimax from "./assets/icons/minimax.svg";
import iconZhipu from "./assets/icons/zhipu.svg";
import iconKimi from "./assets/icons/kimi.svg";
import iconStepfun from "./assets/icons/stepfun.svg";

const MODEL_ICONS: Record<string, string> = {
  deepseek: iconDeepseek, qwen: iconQwen, volcengine: iconVolcengine,
  siliconflow: iconSiliconflow, hunyuan: iconHunyuan, minimax: iconMinimax,
  zhipu: iconZhipu, kimi: iconKimi, stepfun: iconStepfun,
};

/** Map OpenClaw provider IDs to display names */
const PROVIDER_LABELS: Record<string, string> = {
  dashscope: "阿里云百炼 Qwen",
  deepseek: "DeepSeek",
  stepfun: "阶跃星辰",
  minimax: "MiniMax",
  hunyuan: "腾讯混元",
  moonshot: "Kimi (月之暗面)",
  volcengine: "火山方舟",
  zhipu: "智谱 GLM",
  siliconflow: "硅基流动",
};

/** Map OpenClaw provider IDs to ClawBox icon keys */
const PROVIDER_ICON_MAP: Record<string, string> = {
  dashscope: "qwen",
  moonshot: "kimi",
};

/** 价格：元 / 百万 tokens */
const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  dashscope: { input: 1, output: 4 },
  deepseek: { input: 2, output: 3 },
  stepfun: { input: 0.7, output: 2.1 },
  minimax: { input: 2.1, output: 8.4 },
  hunyuan: { input: 3.18, output: 7.95 },
  moonshot: { input: 4, output: 16 },
  volcengine: { input: 0.6, output: 3.6 },
  zhipu: { input: 1, output: 3 },
  siliconflow: { input: 0.7, output: 2.1 },
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function estimateCost(provider: string, input: number, output: number): number | null {
  const p = PROVIDER_PRICING[provider];
  if (!p) return null;
  return (input / 1_000_000) * p.input + (output / 1_000_000) * p.output;
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [isMac, setIsMac] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  // Gateway state
  const [daemonRunning, setDaemonRunning] = useState(false);
  const [daemonPort, setDaemonPort] = useState(18789);
  const [daemonLoading, setDaemonLoading] = useState(false);
  const [version, setVersion] = useState("0.1.0");

  // Summary states for top bar
  const [modelConfigured, setModelConfigured] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [channelCount, setChannelCount] = useState(0);
  const [feishuConfigured, setFeishuConfigured] = useState(false);
  const [securitySafe, setSecuritySafe] = useState(true);
  const [usage, setUsage] = useState<UsageStats | null>(null);

  const refreshSummary = async () => {
    try {
      const api = window.clawbox;
      if (!api) return;
      const [modelCfg, feishuCfg, secCfg, daemon, usageStats] = await Promise.all([
        api.getModelConfig(),
        api.getFeishuConfig(),
        api.getSecurityConfig(),
        api.getDaemonStatus(),
        api.getUsageStats(),
      ]);
      if (usageStats) setUsage(usageStats);
      setDaemonRunning(daemon.running);
      setDaemonPort(daemon.port);
      setModelConfigured(!!modelCfg?.apiKey);
      setModelName(modelCfg?.name ?? null);
      setModelId(modelCfg?.id ?? null);
      const feishuOk = !!(feishuCfg?.appId && feishuCfg?.appSecret);
      setFeishuConfigured(feishuOk);
      setChannelCount((feishuOk ? 1 : 0) + (daemon.running ? 1 : 0));
      if (secCfg) {
        const allItems: (keyof SecurityConfig)[] = ["blockPublicExpose", "blockShellAccess", "blockFullDiskAccess", "encryptCredentials", "promptScanEnabled"];
        const safe = allItems.every((k) => secCfg[k]) && !secCfg.groupChatEnabled;
        setSecuritySafe(safe);
      }
    } catch { /* */ }
  };

  useEffect(() => {
    (async () => {
      try {
        if (window.clawbox) {
          const [complete, status, v, platform] = await Promise.all([
            window.clawbox.getOnboardingComplete(),
            window.clawbox.getDaemonStatus(),
            window.clawbox.getVersion(),
            window.clawbox.getPlatform(),
          ]);
          setIsMac(platform === "darwin");
          setShowOnboarding(!complete);
          setDaemonRunning(status.running);
          setDaemonPort(status.port);
          setVersion(v);
          refreshSummary();
        } else {
          const complete = localStorage.getItem("clawbox-onboarding-complete") === "true";
          setShowOnboarding(!complete);
        }
      } catch {
        setShowOnboarding(false);
      }
    })();
  }, []);

  // Listen for config changes to refresh summary
  useEffect(() => {
    const handler = () => { refreshSummary(); };
    window.addEventListener("clawbox-config-changed", handler);
    return () => window.removeEventListener("clawbox-config-changed", handler);
  }, []);

  // Live usage updates from backend file watcher
  useEffect(() => {
    if (!window.clawbox?.onUsageUpdated) return;
    const unsub = window.clawbox.onUsageUpdated((stats) => {
      setUsage(stats);
    });
    return unsub;
  }, []);

  // Security alerts
  useEffect(() => {
    if (!window.clawbox?.onSecurityAlert) return;
    const unsub = window.clawbox.onSecurityAlert((alert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev];
      });
    });
    return unsub;
  }, []);

  // Onboarding reset
  useEffect(() => {
    const handler = () => { setShowOnboarding(true); };
    window.addEventListener("clawbox-reset-onboarding", handler);
    return () => window.removeEventListener("clawbox-reset-onboarding", handler);
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    window.clawbox?.dismissSecurityAlert(alertId);
  }, []);

  const handleAlertAction = useCallback((alert: SecurityAlert) => {
    dismissAlert(alert.id);
  }, [dismissAlert]);

  const refreshDaemon = async () => {
    // refreshSummary already calls getDaemonStatus, avoid duplicate 2s timeout
    await refreshSummary();
  };

  const handleStart = async () => {
    setDaemonLoading(true);
    try {
      const result = await window.clawbox?.startDaemon();
      if (result && !result.success) console.error("Daemon start failed:", result.message);
      await refreshDaemon();
    } catch (err) { console.error("Daemon start error:", err); }
    setDaemonLoading(false);
  };

  const handleStop = async () => {
    setDaemonLoading(true);
    try {
      await window.clawbox?.stopDaemon();
      await refreshDaemon();
    } catch (err) { console.error("Daemon stop error:", err); }
    setDaemonLoading(false);
  };

  const handleRestart = async () => {
    setDaemonLoading(true);
    try {
      const result = await window.clawbox?.restartDaemon();
      if (result && !result.success) console.error("Daemon restart failed:", result.message);
      await refreshDaemon();
    } catch (err) { console.error("Daemon restart error:", err); }
    setDaemonLoading(false);
  };

  // Loading
  if (showOnboarding === null) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-[11px] text-neutral-400">加载中...</div>
      </div>
    );
  }

  // Onboarding
  if (showOnboarding) {
    return <Onboarding isMac={isMac} onComplete={() => { setShowOnboarding(false); refreshSummary(); }} />;
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Titlebar drag region (macOS only — Windows uses native menu bar) */}
      {isMac && <div className="fixed top-0 left-0 right-0 h-12 titlebar-drag z-50" />}

      {/* Security alert banners */}
      <div className={`flex-shrink-0 ${isMac ? "pt-12" : "pt-2"}`}>
        <AnimatePresence>
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className={`px-6 py-2.5 flex items-center gap-3 ${
                alert.level === "error" ? "bg-[#FFF1F2]" : "bg-[#FFFBEB]"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  alert.level === "error" ? "bg-[#FF3B30]" : "bg-[#FF9F0A]"
                }`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-[10px] font-medium ${
                    alert.level === "error" ? "text-[#E11D48]" : "text-[#D97706]"
                  }`}>{alert.title}</span>
                  <span className={`text-[10px] ml-2 ${
                    alert.level === "error" ? "text-[#E11D48]/70" : "text-[#D97706]/70"
                  }`}>{alert.detail}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {alert.action && (
                    <button onClick={() => handleAlertAction(alert)} className={`text-[10px] font-medium px-2 py-1 rounded-lg ${
                      alert.level === "error" ? "bg-[#E11D48] text-white" : "bg-[#D97706] text-white"
                    }`}>前往处理</button>
                  )}
                  <button onClick={() => dismissAlert(alert.id)} className={`text-[10px] font-medium px-2 py-1 rounded-lg ${
                    alert.level === "error" ? "text-[#E11D48] bg-[#E11D48]/10" : "text-[#D97706] bg-[#D97706]/10"
                  }`}>忽略</button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Scrollable page content */}
      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
              {/* Left: icon + title + gateway */}
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <img src={clawboxIconSrc} alt="" className={`w-5 h-5 flex-shrink-0 transition-opacity duration-300 ${daemonRunning ? "opacity-100" : "opacity-30"}`} />
                    <span className="text-[14px] font-medium text-neutral-700">ClawBox</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${daemonLoading ? "bg-amber-400 animate-pulse" : daemonRunning ? "bg-emerald-500" : "bg-neutral-300"}`} />
                    <span className="text-[10px] text-neutral-400">
                      <Term k="Gateway" />
                    </span>
                    {daemonRunning ? (
                      <button
                        onClick={async () => {
                          try { await window.clawbox?.openBrowserControl(); } catch { /* */ }
                        }}
                        className="text-[10px] text-neutral-400 hover:text-[#2563EB] transition-colors duration-200 font-mono"
                      >
                        http://127.0.0.1:{daemonPort}
                      </button>
                    ) : (
                      <span className="text-[10px] text-neutral-400">
                        {daemonLoading ? "操作中..." : "未启动"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {!daemonRunning ? (
                    <ActionBtn label={daemonLoading ? "启动中..." : "启动"} onClick={handleStart} disabled={daemonLoading} />
                  ) : (
                    <>
                      <ActionBtn label={daemonLoading ? "重启中..." : "重启"} onClick={handleRestart} disabled={daemonLoading} />
                      <ActionBtn label="停止" onClick={handleStop} variant="secondary" disabled={daemonLoading} />
                    </>
                  )}
                </div>
              </div>

              {/* Right: Security + Settings */}
              <div className="flex items-center gap-2">
                {/* Security pill with particle sphere */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSecurityOpen(true)}
                  className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors duration-200 ${
                    !daemonRunning
                      ? "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"
                      : securitySafe
                        ? "bg-[#ECFDF5] text-[#059669] hover:bg-emerald-100"
                        : "bg-[#FFFBEB] text-[#D97706] hover:bg-amber-100"
                  }`}
                >
                  {daemonRunning ? (
                    <SecurityParticles
                      size={22}
                      sphereRadius={9}
                      color={securitySafe ? [16, 185, 129] : [245, 158, 11]}
                    />
                  ) : (
                    <ShieldCheck size={13} className="ml-1" />
                  )}
                  {!daemonRunning ? "安全防护" : securitySafe ? "已开启防护" : "存在风险"}
                </motion.button>

                {/* Settings gear */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSettingsOpen(true)}
                  className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors duration-200"
                >
                  <Settings size={15} strokeWidth={1.8} />
                </motion.button>
              </div>
            </div>

            {/* Config summary cards — Model & Channel */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Model card — with inline token usage */}
              <motion.button
                whileTap={{ scale: 0.99 }}
                onClick={() => setModelOpen(true)}
                className="bg-neutral-100 rounded-2xl p-4 text-left cursor-pointer hover:bg-neutral-200/60 transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  {modelId && MODEL_ICONS[modelId] ? (
                    <img src={MODEL_ICONS[modelId]} alt="" className="w-8 h-8 rounded-xl flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[10px] text-neutral-400 flex-shrink-0">AI</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-0.5"><Term k="模型" /></div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${modelConfigured ? "bg-emerald-500" : "bg-neutral-300"}`} />
                      <span className="text-[11px] font-medium text-neutral-700">
                        {modelConfigured ? modelName : "未配置"}
                      </span>
                      {usage && usage.total.requests > 0 && (() => {
                        const totalCost = Object.entries(usage.byProvider).reduce((sum, [pid, p]) => sum + (estimateCost(pid, p.inputTokens, p.outputTokens) ?? 0), 0);
                        return (
                          <span className="text-[9px] text-neutral-400 tabular-nums ml-auto">
                            {formatTokens(usage.total.inputTokens)} / {formatTokens(usage.total.outputTokens)}
                            {totalCost > 0 && <span className="text-neutral-300 ml-1.5">¥{totalCost < 0.01 ? "<0.01" : totalCost.toFixed(2)}</span>}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#2563EB] flex-shrink-0">&rarr;</span>
                </div>
              </motion.button>

              {/* Channel card */}
              <motion.button
                whileTap={{ scale: 0.99 }}
                onClick={() => setChannelOpen(true)}
                className="bg-neutral-100 rounded-2xl p-4 text-left cursor-pointer hover:bg-neutral-200/60 transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {feishuConfigured ? (
                      <img src={feishuIconSrc} alt="飞书" className="w-5 h-5" />
                    ) : (
                      <span className="text-[10px] text-neutral-400">CH</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-0.5"><Term k="通道" /></div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${channelCount > 0 ? "bg-emerald-500" : "bg-neutral-300"}`} />
                      <span className="text-[11px] font-medium text-neutral-700">
                        {channelCount > 0 ? `${channelCount} 个可用` : "未配置"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#2563EB] flex-shrink-0">&rarr;</span>
                </div>
              </motion.button>
            </div>

      </main>

      {/* Dialogs */}
      <ModelDialog open={modelOpen} onClose={() => { setModelOpen(false); refreshSummary(); }} />
      <ChannelDialog open={channelOpen} onClose={() => { setChannelOpen(false); refreshDaemon(); }} />
      <SecurityDialog open={securityOpen} onClose={() => { setSecurityOpen(false); refreshSummary(); }} daemonRunning={daemonRunning} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function ActionBtn({ label, onClick, variant = "primary", disabled = false }: { label: string; onClick: () => void; variant?: "primary" | "secondary"; disabled?: boolean }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`text-[10px] font-medium px-3 py-1.5 rounded-lg transition-colors duration-200 ${
        disabled
          ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
          : variant === "primary"
            ? "bg-neutral-800 text-white"
            : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
      }`}
    >
      {label}
    </motion.button>
  );
}
