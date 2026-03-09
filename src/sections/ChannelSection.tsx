import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Eye, EyeOff } from "lucide-react";
import type { FeishuConfig, FeishuPreflightCheck } from "../types/global";
import Term from "../components/Glossary";
import feishuIconSrc from "../assets/icons/feishu.png";
import discordIconSrc from "../assets/icons/discord.png";

const openLink = async (url: string) => {
  try {
    if (window.clawbox?.openExternal) await window.clawbox.openExternal(url);
    else window.open(url, "_blank");
  } catch { window.open(url, "_blank"); }
};

type ChannelTab = "feishu" | "discord" | "cli";

const CHANNEL_TABS: { key: ChannelTab; label: string; icon: React.ReactNode; comingSoon?: boolean }[] = [
  { key: "feishu", label: "飞书", icon: <img src={feishuIconSrc} alt="" className="w-3.5 h-3.5" /> },
  { key: "discord", label: "Discord", icon: <img src={discordIconSrc} alt="" className="w-3.5 h-3.5" />, comingSoon: true },
  { key: "cli", label: "本地 CLI", icon: <span className="text-[9px] font-mono text-neutral-400">&gt;_</span> },
];

/* ── Feishu setup sub-steps (guidance for Step 1) ── */
const FEISHU_GUIDE_STEPS = [
  { id: "create", label: "创建企业自建应用", hint: "点击「创建应用」，应用类型选「企业自建应用」" },
  { id: "bot", label: "开启机器人能力", hint: "应用详情 → 添加应用能力 → 机器人" },
  { id: "ws", label: "启用 WebSocket 模式", hint: "事件与回调 → 接收方式选「长连接」" },
  { id: "permissions", label: "添加权限", hint: "权限管理 → 添加 im:message、im:message:send_as_bot、im:resource" },
  { id: "publish", label: "创建版本并发布", hint: "版本管理与发布 → 创建版本 → 申请发布" },
];

interface ChannelDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ChannelDialog({ open, onClose }: ChannelDialogProps) {
  const [activeTab, setActiveTab] = useState<ChannelTab>("feishu");

  const [feishuConfig, setFeishuConfig] = useState<FeishuConfig>({ appId: "", appSecret: "", verificationToken: "", encryptKey: "" });
  const [showSecret, setShowSecret] = useState(false);

  const [activating, setActivating] = useState(false);
  const [activateStage, setActivateStage] = useState("");
  const [activateResult, setActivateResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [preflightChecks, setPreflightChecks] = useState<FeishuPreflightCheck[]>([]);
  const [preflightLoading, setPreflightLoading] = useState(false);

  const [connected, setConnected] = useState(false);
  const [botName, setBotName] = useState<string | null>(null);

  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [gatewayPort, setGatewayPort] = useState(18789);

  const preflightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const api = window.clawbox;
      if (!api) return;
      const [feishu, daemon] = await Promise.all([api.getFeishuConfig(), api.getDaemonStatus()]);
      if (feishu) setFeishuConfig(feishu);
      setGatewayRunning(daemon.running);
      setGatewayPort(daemon.port);

      // Check existing connection status
      if (feishu?.appId && feishu?.appSecret) {
        try {
          const test = await api.testFeishuConnection();
          if (test?.success) {
            setConnected(true);
            if (test.botName) setBotName(test.botName);
          }
        } catch { /* ignore */ }
      }
    })();
  }, [open]);

  const appId = feishuConfig.appId.trim();
  const feishuIsValid = appId && feishuConfig.appSecret.trim();
  const feishuAppUrl = appId ? `https://open.feishu.cn/app/${appId}` : null;
  const hasPreflightFailures = preflightChecks.some((c) => !c.passed);

  /* ── Auto-preflight: debounced after credentials entered ── */
  const runPreflight = useCallback(async (config: FeishuConfig) => {
    const id = config.appId.trim();
    const secret = config.appSecret.trim();
    if (!id || !secret) return;
    setPreflightLoading(true);
    try {
      const checks = await window.clawbox?.feishuPreflight({ appId: id, appSecret: secret });
      if (checks) setPreflightChecks(checks);
    } catch { /* ignore */ }
    setPreflightLoading(false);
  }, []);

  const schedulePreflightCheck = useCallback((config: FeishuConfig) => {
    if (preflightTimer.current) clearTimeout(preflightTimer.current);
    if (!config.appId.trim() || !config.appSecret.trim()) return;
    preflightTimer.current = setTimeout(() => runPreflight(config), 1000);
  }, [runPreflight]);

  useEffect(() => () => { if (preflightTimer.current) clearTimeout(preflightTimer.current); }, []);

  const updateFeishuConfig = (patch: Partial<FeishuConfig>) => {
    const next = { ...feishuConfig, ...patch };
    setFeishuConfig(next);
    setActivateResult(null);
    setConnected(false);
    setBotName(null);
    schedulePreflightCheck(next);
  };

  const handleActivate = async () => {
    setActivating(true);
    setActivateResult(null);
    setPreflightChecks([]);
    setActivateStage("preflight");
    try {
      const result = await window.clawbox?.activateFeishuChannel(feishuConfig);
      if (!result) { setActivateResult({ success: false, error: "API not available" }); return; }
      if (result.checks) setPreflightChecks(result.checks);
      if (result.stage === "preflight") {
        setActivateResult({ success: false, error: result.error });
      } else {
        setActivateResult({ success: result.success, error: result.error });
      }
      if (result.success) {
        setConnected(true);
        // Fetch bot name & daemon status
        const [test, daemon] = await Promise.all([
          window.clawbox?.testFeishuConnection(),
          window.clawbox?.getDaemonStatus(),
        ]);
        if (test?.botName) setBotName(test.botName);
        if (daemon) { setGatewayRunning(daemon.running); setGatewayPort(daemon.port); }
        window.dispatchEvent(new CustomEvent("clawbox-config-changed"));
      }
    } catch (err) { setActivateResult({ success: false, error: String(err) }); }
    setActivating(false);
    setActivateStage("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative bg-white rounded-3xl w-[520px] max-h-[80vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-[14px] font-medium text-neutral-700">通道配置</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">管理消息入口，连接远程通讯平台</div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-400 transition-colors duration-200">
                <X size={14} />
              </motion.button>
            </div>

            {/* Channel tabs */}
            <div className="px-6 pb-3 flex gap-1.5">
              {CHANNEL_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => !tab.comingSoon && setActiveTab(tab.key)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium z-[1] ${
                    tab.comingSoon ? "opacity-50 cursor-default" : ""
                  }`}
                >
                  {activeTab === tab.key && !tab.comingSoon && (
                    <motion.div
                      layoutId="channel-tab-active"
                      className="absolute inset-0 bg-neutral-800 rounded-lg"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className={`relative z-[1] flex items-center gap-1.5 transition-colors duration-200 ${
                    activeTab === tab.key && !tab.comingSoon ? "text-white" : "text-neutral-500"
                  }`}>
                    {tab.icon}
                    {tab.label}
                    {tab.comingSoon && (
                      <span className="text-[8px] font-medium bg-neutral-200 text-neutral-400 px-1 py-0.5 rounded">即将支持</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="px-6 pb-6 overflow-y-auto" style={{ height: 420 }}>
              <AnimatePresence mode="wait" initial={false}>
                {activeTab === "feishu" && (
                  <motion.div
                    key="feishu"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    {/* ── Success state ── */}
                    <AnimatePresence>
                      {connected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="bg-[#ECFDF5] rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                                <Check size={16} className="text-[#059669]" strokeWidth={2.5} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-medium text-[#059669]">
                                  {botName ? `${botName} 已接入 ClawBox` : "飞书通道已激活"}
                                </div>
                                <div className="text-[9px] text-[#059669]/60 mt-0.5">
                                  消息将通过飞书机器人实时收发
                                </div>
                              </div>
                              <img src={feishuIconSrc} alt="" className="w-5 h-5 opacity-40 flex-shrink-0" />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="bg-neutral-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <img src={feishuIconSrc} alt="飞书" className="w-5 h-5" />
                        <span className="text-[11px] font-medium text-neutral-700">飞书机器人</span>
                        {connected && (
                          <span className="text-[8px] font-medium text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded ml-auto">已连接</span>
                        )}
                      </div>

                      <p className="text-[10px] text-neutral-400 leading-relaxed">
                        将飞书机器人接入 ClawBox，需要先在飞书开放平台创建应用并配置能力，然后填入凭证连接。全程约 3 分钟。
                      </p>

                      {/* Step 1 — Guided sub-checklist */}
                      <div className="bg-white rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2.5">
                          <StepNumber n={1} done={!!feishuAppUrl} />
                          <span className="text-[10px] font-medium text-neutral-700">在飞书后台创建并配置应用</span>
                        </div>

                        <div className="space-y-2 mb-3">
                          {FEISHU_GUIDE_STEPS.map((step, i) => {
                            const check = preflightChecks.find((c) => c.key === step.id);
                            const passed = check?.passed;
                            const failed = check && !check.passed;
                            return (
                              <div key={step.id} className="flex items-start gap-2 pl-1">
                                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  passed ? "bg-[#ECFDF5]" : failed ? "bg-red-50" : "bg-neutral-100"
                                }`}>
                                  {passed ? (
                                    <Check size={8} className="text-[#059669]" strokeWidth={3} />
                                  ) : (
                                    <span className={`text-[7px] font-bold ${failed ? "text-red-400" : "text-neutral-300"}`}>{i + 1}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-medium ${passed ? "text-[#059669]" : failed ? "text-red-500" : "text-neutral-600"}`}>
                                      {step.label}
                                    </span>
                                    {failed && check?.fixUrl && (
                                      <button onClick={() => openLink(check.fixUrl!)} className="text-[8px] font-medium text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors duration-200">
                                        去配置
                                      </button>
                                    )}
                                  </div>
                                  <p className={`text-[9px] mt-0.5 ${failed ? "text-red-400" : "text-neutral-400"}`}>
                                    {failed && check?.detail ? check.detail : step.hint}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Preflight status indicator */}
                        {preflightLoading && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-[9px] text-neutral-400">正在检测应用配置...</span>
                          </div>
                        )}

                        {/* Unmatched preflight checks (not in guide steps) */}
                        {preflightChecks.filter((c) => !FEISHU_GUIDE_STEPS.some((s) => s.id === c.key)).length > 0 && !activating && (
                          <div className="space-y-1.5 mb-2">
                            {preflightChecks
                              .filter((c) => !FEISHU_GUIDE_STEPS.some((s) => s.id === c.key))
                              .map((check) => (
                                <div key={check.key} className="flex items-start gap-2 pl-1">
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${check.passed ? "bg-[#059669]" : "bg-red-400"}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-[10px] font-medium ${check.passed ? "text-neutral-600" : "text-red-500"}`}>{check.label}</span>
                                      {!check.passed && check.fixUrl && (
                                        <button onClick={() => openLink(check.fixUrl!)} className="text-[8px] font-medium text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors duration-200">去修复</button>
                                      )}
                                    </div>
                                    <p className="text-[9px] text-neutral-400 mt-0.5">{check.detail}</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}

                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => openLink(feishuAppUrl || "https://open.feishu.cn/app/")}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                        >
                          <ExternalLinkIcon />
                          {feishuAppUrl ? "打开此应用的后台" : "打开飞书开放平台"}
                        </motion.button>
                      </div>

                      {/* Step 2 — Credentials */}
                      <div className="bg-white rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <StepNumber n={2} done={!!feishuIsValid} />
                          <span className="text-[10px] font-medium text-neutral-700">填入应用凭证</span>
                        </div>
                        <div>
                          <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1 block"><Term k="App ID" /> <span className="text-red-400">*</span></label>
                          <input value={feishuConfig.appId} onChange={(e) => updateFeishuConfig({ appId: e.target.value })} placeholder="cli_xxxxx" className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300" />
                        </div>
                        <div>
                          <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1 block"><Term k="App Secret" /> <span className="text-red-400">*</span></label>
                          <div className="relative">
                            <input
                              type={showSecret ? "text" : "password"}
                              value={feishuConfig.appSecret}
                              onChange={(e) => updateFeishuConfig({ appSecret: e.target.value })}
                              placeholder="xxxxx"
                              className="w-full bg-neutral-50 rounded-lg px-3 py-2 pr-8 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSecret(!showSecret)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500 transition-colors duration-200"
                            >
                              {showSecret ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        </div>
                        {feishuAppUrl && (
                          <motion.button whileTap={{ scale: 0.97 }} onClick={() => openLink(`${feishuAppUrl}/baseinfo`)} className="inline-flex items-center gap-1 text-[9px] font-medium text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-lg hover:bg-blue-100 transition-colors duration-200 mt-1">
                            打开此应用的凭证页
                          </motion.button>
                        )}
                      </div>

                      {/* Step 3 — Connect */}
                      <div className="bg-white rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <StepNumber n={3} done={connected} />
                          <span className="text-[10px] font-medium text-neutral-700">保存并连接</span>
                        </div>
                        <div className="space-y-2">
                          <motion.button
                            whileTap={!feishuIsValid || activating ? undefined : { scale: 0.97 }}
                            onClick={handleActivate}
                            disabled={!feishuIsValid || activating}
                            className={`text-[10px] font-medium px-4 py-2 rounded-lg transition-colors duration-200 ${
                              connected
                                ? "bg-[#ECFDF5] text-[#059669]"
                                : !feishuIsValid || activating
                                  ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                                  : "bg-neutral-800 text-white"
                            }`}
                          >
                            {activating
                              ? (activateStage === "preflight" ? "检测配置中..." : "连接中...")
                              : connected
                                ? "重新连接"
                                : hasPreflightFailures
                                  ? "重新检测"
                                  : "保存并连接"}
                          </motion.button>

                          {activating && (
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <span className="text-[9px] text-neutral-400">{activateStage === "preflight" ? "验证凭证中..." : "等待飞书长连接建立..."}</span>
                            </div>
                          )}

                          {activateResult && !activating && !activateResult.success && (
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              <span className="text-[10px] font-medium text-red-400">
                                {activateResult.error || "连接失败"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}

                {activeTab === "cli" && (
                  <motion.div
                    key="cli"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    <div className="bg-neutral-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-mono text-neutral-500">&gt;_</span>
                        <span className="text-[11px] font-medium text-neutral-700">本地 <Term k="CLI" /> / HTTP API</span>
                        {gatewayRunning ? (
                          <span className="text-[8px] font-medium text-emerald-600 bg-[#ECFDF5] px-1.5 py-0.5 rounded ml-auto">可用</span>
                        ) : (
                          <span className="text-[8px] font-medium text-neutral-400 bg-neutral-200 px-1.5 py-0.5 rounded ml-auto">Gateway 未启动</span>
                        )}
                      </div>

                      <p className="text-[10px] text-neutral-400">
                        通过命令行或 HTTP 请求直接调用 <Term k="Gateway" />，无需额外配置
                      </p>

                      <div className="bg-white rounded-xl p-3">
                        <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
                          Gateway 地址
                        </label>
                        <div className="text-[10px] text-neutral-500 font-mono bg-neutral-50 rounded-lg px-3 py-2 select-all">
                          http://127.0.0.1:{gatewayPort}
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-3">
                        <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
                          示例请求
                        </label>
                        <pre className="text-[10px] text-neutral-400 font-mono bg-neutral-50 rounded-lg px-3 py-2 whitespace-pre-wrap leading-5 select-all">
                          {`curl http://127.0.0.1:${gatewayPort}/v1/chat \\\n  -H "Content-Type: application/json" \\\n  -d '{"message": "你好"}'`}
                        </pre>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Step number indicator ── */
function StepNumber({ n, done }: { n: number; done: boolean }) {
  return (
    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-200 ${
      done ? "bg-[#ECFDF5]" : "bg-neutral-100"
    }`}>
      {done ? (
        <Check size={9} className="text-[#059669]" strokeWidth={3} />
      ) : (
        <span className="text-[8px] font-bold text-neutral-400">{n}</span>
      )}
    </div>
  );
}

/* ── External link icon ── */
function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
      <path d="M5 3H3.5C2.67 3 2 3.67 2 4.5v4C2 9.33 2.67 10 3.5 10h4c.83 0 1.5-.67 1.5-1.5V7M7 2h3v3M5.5 6.5L10 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

