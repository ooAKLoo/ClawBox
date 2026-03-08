import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
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

interface ChannelDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ChannelDialog({ open, onClose }: ChannelDialogProps) {
  const [activeTab, setActiveTab] = useState<ChannelTab>("feishu");

  const [feishuConfig, setFeishuConfig] = useState<FeishuConfig>({ appId: "", appSecret: "", verificationToken: "", encryptKey: "" });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [activating, setActivating] = useState(false);
  const [activateStage, setActivateStage] = useState("");
  const [activateResult, setActivateResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [preflightChecks, setPreflightChecks] = useState<FeishuPreflightCheck[]>([]);

  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [gatewayPort, setGatewayPort] = useState(18789);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const api = window.clawbox;
      if (!api) return;
      const [feishu, daemon] = await Promise.all([api.getFeishuConfig(), api.getDaemonStatus()]);
      if (feishu) setFeishuConfig(feishu);
      setGatewayRunning(daemon.running);
      setGatewayPort(daemon.port);
    })();
  }, [open]);

  const feishuIsValid = feishuConfig.appId.trim() && feishuConfig.appSecret.trim();
  const feishuConfigured = !!(feishuConfig.appId && feishuConfig.appSecret);
  const appId = feishuConfig.appId.trim();
  const feishuAppUrl = appId ? `https://open.feishu.cn/app/${appId}` : null;
  const hasPreflightFailures = preflightChecks.some((c) => !c.passed);

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
        const daemon = await window.clawbox?.getDaemonStatus();
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
                    <div className="bg-neutral-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <img src={feishuIconSrc} alt="飞书" className="w-5 h-5" />
                        <span className="text-[11px] font-medium text-neutral-700">飞书机器人</span>
                        {activateResult?.success && (
                          <span className="text-[8px] font-medium text-emerald-600 bg-[#ECFDF5] px-1.5 py-0.5 rounded ml-auto">已连接</span>
                        )}
                      </div>

                      {/* Step 1 */}
                      <div className="bg-white rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded-full bg-neutral-100 flex items-center justify-center text-[8px] font-bold text-neutral-400">1</div>
                          <span className="text-[10px] font-medium text-neutral-700">创建飞书应用</span>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => openLink("https://open.feishu.cn/app/")}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                            <path d="M5 3H3.5C2.67 3 2 3.67 2 4.5v4C2 9.33 2.67 10 3.5 10h4c.83 0 1.5-.67 1.5-1.5V7M7 2h3v3M5.5 6.5L10 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          打开飞书开放平台
                        </motion.button>
                      </div>

                      {/* Step 2 */}
                      <div className="bg-white rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-4 h-4 rounded-full bg-neutral-100 flex items-center justify-center text-[8px] font-bold text-neutral-400">2</div>
                          <span className="text-[10px] font-medium text-neutral-700">填入应用凭证</span>
                        </div>
                        <div>
                          <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1 block"><Term k="App ID" /> <span className="text-red-400">*</span></label>
                          <input value={feishuConfig.appId} onChange={(e) => setFeishuConfig({ ...feishuConfig, appId: e.target.value })} placeholder="cli_xxxxx" className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300" />
                        </div>
                        <div>
                          <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1 block"><Term k="App Secret" /> <span className="text-red-400">*</span></label>
                          <input type="password" value={feishuConfig.appSecret} onChange={(e) => setFeishuConfig({ ...feishuConfig, appSecret: e.target.value })} placeholder="xxxxx" className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300" />
                        </div>
                        {feishuAppUrl && (
                          <motion.button whileTap={{ scale: 0.97 }} onClick={() => openLink(`${feishuAppUrl}/baseinfo`)} className="inline-flex items-center gap-1 text-[9px] font-medium text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-lg hover:bg-blue-100 transition-colors duration-200 mt-1">
                            打开此应用的凭证页
                          </motion.button>
                        )}
                      </div>

                      {/* Step 3 */}
                      <div className="bg-white rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded-full bg-neutral-100 flex items-center justify-center text-[8px] font-bold text-neutral-400">3</div>
                          <span className="text-[10px] font-medium text-neutral-700">保存并连接</span>
                        </div>
                        <div className="space-y-2">
                          <motion.button
                            whileTap={!feishuIsValid || activating ? undefined : { scale: 0.97 }}
                            onClick={handleActivate}
                            disabled={!feishuIsValid || activating}
                            className={`text-[10px] font-medium px-4 py-2 rounded-lg transition-colors duration-200 ${!feishuIsValid || activating ? "bg-neutral-200 text-neutral-400 cursor-not-allowed" : "bg-neutral-800 text-white"}`}
                          >
                            {activating ? (activateStage === "preflight" ? "检测配置中..." : "连接中...") : hasPreflightFailures ? "重新检测" : "保存并连接"}
                          </motion.button>

                          {activating && (
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <span className="text-[9px] text-neutral-400">{activateStage === "preflight" ? "验证凭证中..." : "等待飞书长连接建立..."}</span>
                            </div>
                          )}

                          {preflightChecks.length > 0 && !activating && (
                            <div className="space-y-1.5 mt-1">
                              {preflightChecks.map((check) => (
                                <div key={check.key} className="flex items-start gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${check.passed ? "bg-emerald-500" : "bg-red-400"}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-medium ${check.passed ? "text-neutral-600" : "text-red-500"}`}>{check.label}</span>
                                      {!check.passed && check.fixUrl && (
                                        <button onClick={() => openLink(check.fixUrl!)} className="text-[9px] font-medium text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors duration-200">去修复</button>
                                      )}
                                    </div>
                                    <p className="text-[9px] text-neutral-400 mt-0.5">{check.detail}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {activateResult && !activating && !hasPreflightFailures && (
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${activateResult.success ? "bg-emerald-500" : "bg-red-400"}`} />
                              <span className={`text-[10px] font-medium ${activateResult.success ? "text-emerald-600" : "text-red-400"}`}>
                                {activateResult.success ? "飞书通道已激活" : activateResult.error || "连接失败"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Advanced */}
                      <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-[9px] text-neutral-400 hover:text-neutral-500 transition-colors duration-200">
                        {showAdvanced ? "收起高级设置 ▴" : "高级设置 ▾"}
                      </button>
                      <AnimatePresence>
                        {showAdvanced && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden space-y-2">
                            <ConfigField label={<Term k="Verification Token" />} value={feishuConfig.verificationToken} onChange={(v) => setFeishuConfig({ ...feishuConfig, verificationToken: v })} placeholder="可选" />
                            <ConfigField label={<Term k="Encrypt Key" />} value={feishuConfig.encryptKey} onChange={(v) => setFeishuConfig({ ...feishuConfig, encryptKey: v })} placeholder="可选" />
                          </motion.div>
                        )}
                      </AnimatePresence>
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

function ConfigField({ label, value, onChange, placeholder }: {
  label: React.ReactNode; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-3">
      <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1 block">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300" />
    </div>
  );
}
