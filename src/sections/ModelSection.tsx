import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ModelProvider } from "../types/global";
import Term from "../components/Glossary";

import iconDeepseek from "../assets/icons/deepseek.svg";
import iconQwen from "../assets/icons/qwen.svg";
import iconVolcengine from "../assets/icons/volcengine.svg";
import iconSiliconflow from "../assets/icons/siliconflow.svg";
import iconHunyuan from "../assets/icons/hunyuan.svg";
import iconMinimax from "../assets/icons/minimax.svg";
import iconZhipu from "../assets/icons/zhipu.svg";
import iconKimi from "../assets/icons/kimi.svg";
import iconStepfun from "../assets/icons/stepfun.svg";

type ModelPricing = { input: number; output: number; note?: string };

const PROVIDERS = [
  { id: "deepseek", name: "DeepSeek", icon: iconDeepseek, baseUrl: "https://api.deepseek.com/v1", models: ["deepseek-chat", "deepseek-reasoner"], pricing: { "deepseek-chat": { input: 2, output: 3, note: "缓存命中输入 ¥0.2/M" }, "deepseek-reasoner": { input: 2, output: 3, note: "缓存命中输入 ¥0.2/M" } } as Record<string, ModelPricing>, tag: "省心推荐", portalUrl: "https://platform.deepseek.com/api_keys", portalLabel: "打开 DeepSeek 开放平台" },
  { id: "qwen", name: "阿里云百炼 Qwen", icon: iconQwen, baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen3-next-80b-a3b-instruct", "qwen3-next-80b-a3b-thinking"], pricing: { "qwen3-next-80b-a3b-instruct": { input: 1, output: 4 }, "qwen3-next-80b-a3b-thinking": { input: 1, output: 10 } } as Record<string, ModelPricing>, tag: "稳定推荐", portalUrl: "https://bailian.console.aliyun.com/cn-beijing/?tab=model#/api-key", portalLabel: "打开阿里云百炼控制台" },
  { id: "stepfun", name: "阶跃星辰", icon: iconStepfun, baseUrl: "https://api.stepfun.com/v1", models: ["step-3.5-flash", "step-3"], pricing: { "step-3.5-flash": { input: 0.7, output: 2.1 }, "step-3": { input: 4, output: 16 } } as Record<string, ModelPricing>, tag: "", portalUrl: "https://platform.stepfun.com/", portalLabel: "打开阶跃星辰开放平台" },
  { id: "minimax", name: "MiniMax", icon: iconMinimax, baseUrl: "https://api.minimax.chat/v1", models: ["MiniMax-M2.5", "MiniMax-M2.5-highspeed"], pricing: { "MiniMax-M2.5": { input: 2.1, output: 8.4 }, "MiniMax-M2.5-highspeed": { input: 4.2, output: 16.8 } } as Record<string, ModelPricing>, tag: "", portalUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key", portalLabel: "打开 MiniMax 开放平台" },
  { id: "hunyuan", name: "腾讯混元", icon: iconHunyuan, baseUrl: "https://api.hunyuan.cloud.tencent.com/v1", models: ["hunyuan-2.0-instruct", "hunyuan-2.0-think"], pricing: { "hunyuan-2.0-instruct": { input: 3.18, output: 7.95 }, "hunyuan-2.0-think": { input: 3.975, output: 15.9 } } as Record<string, ModelPricing>, tag: "", portalUrl: "https://hunyuan.tencent.com/bot/chat", portalLabel: "打开腾讯混元平台" },
  { id: "kimi", name: "Kimi (月之暗面)", icon: iconKimi, baseUrl: "https://api.moonshot.cn/v1", models: ["kimi-k2-0905-preview"], pricing: { "kimi-k2-0905-preview": { input: 4, output: 16 } } as Record<string, ModelPricing>, tag: "", portalUrl: "https://platform.moonshot.cn/console/api-keys", portalLabel: "打开 Moonshot 开放平台" },
  { id: "volcengine", name: "火山方舟", icon: iconVolcengine, baseUrl: "https://ark.cn-beijing.volces.com/api/v3", models: ["Doubao-Seed-2.0-pro-260215", "Doubao-Seed-2.0-lite-260215", "Doubao-Seed-1.6-vision-250815"], pricing: { "Doubao-Seed-2.0-pro-260215": { input: 3.2, output: 16 }, "Doubao-Seed-2.0-lite-260215": { input: 0.6, output: 3.6 }, "Doubao-Seed-1.6-vision-250815": { input: 0.8, output: 8 } } as Record<string, ModelPricing>, tag: "", portalUrl: "https://console.volcengine.com/ark", portalLabel: "打开火山方舟控制台" },
  { id: "zhipu", name: "智谱 GLM", icon: iconZhipu, baseUrl: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-4.6v"], pricing: { "glm-4.6v": { input: 1, output: 3 } } as Record<string, ModelPricing>, tag: "", portalUrl: "https://open.bigmodel.cn/usercenter/apikeys", portalLabel: "打开智谱开放平台" },
  { id: "siliconflow", name: "硅基流动", icon: iconSiliconflow, baseUrl: "https://api.siliconflow.cn/v1", models: ["Step-3.5-Flash", "deepseek-ai/DeepSeek-V3.2", "zhipu-ai/GLM-4.6V", "MiniMax/MiniMax-M2.5"], pricing: { "Step-3.5-Flash": { input: 0.7, output: 2.1 }, "deepseek-ai/DeepSeek-V3.2": { input: 2, output: 3 }, "zhipu-ai/GLM-4.6V": { input: 1, output: 3 }, "MiniMax/MiniMax-M2.5": { input: 2.1, output: 8.4 } } as Record<string, ModelPricing>, tag: "聚合", portalUrl: "https://cloud.siliconflow.cn/account/ak", portalLabel: "打开硅基流动控制台" },
  { id: "custom", name: "自定义", icon: null as string | null, baseUrl: "", models: [] as string[], pricing: {} as Record<string, ModelPricing>, tag: "", portalUrl: null as string | null, portalLabel: null as string | null },
];

const openLink = async (url: string) => {
  try {
    if (window.clawbox?.openExternal) await window.clawbox.openExternal(url);
    else window.open(url, "_blank");
  } catch { window.open(url, "_blank"); }
};

const formatPrice = (price: number) => `¥${price}`;

interface ModelDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ModelDialog({ open, onClose }: ModelDialogProps) {
  const [activeId, setActiveId] = useState("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [baseUrlOverride, setBaseUrlOverride] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [allConfigs, setAllConfigs] = useState<{ activeId: string | null; providers: Record<string, ModelProvider> }>({ activeId: null, providers: {} });
  const initialLoadRef = useRef(false);

  const active = PROVIDERS.find((p) => p.id === activeId)!;

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const data = await window.clawbox?.getAllModelConfigs();
        if (data) {
          setAllConfigs(data);
          if (data.activeId && data.providers[data.activeId]) {
            const cfg = data.providers[data.activeId];
            setActiveId(cfg.id);
            setApiKey(cfg.apiKey);
            setBaseUrlOverride(cfg.baseUrl);
            if (cfg.id === "custom") setCustomModel(cfg.model);
            else setSelectedModel(cfg.model);
          }
        }
      } catch { /* */ }
      initialLoadRef.current = true;
    })();
  }, [open]);

  const handleSelectProvider = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    setTestResult(null);
    setSaved(false);
    const savedCfg = allConfigs.providers[id];
    const provider = PROVIDERS.find((p) => p.id === id)!;
    if (savedCfg?.apiKey) {
      setApiKey(savedCfg.apiKey);
      setBaseUrlOverride(savedCfg.baseUrl);
      if (id === "custom") setCustomModel(savedCfg.model);
      else setSelectedModel(savedCfg.model || provider.models[0] || "");
    } else {
      setApiKey("");
      setBaseUrlOverride(provider.baseUrl);
      setSelectedModel(provider.models[0] || "");
      if (id === "custom") setCustomModel("");
    }
  };

  const getProvider = (): ModelProvider => ({
    id: active.id,
    name: active.name,
    baseUrl: baseUrlOverride || active.baseUrl,
    apiKey,
    model: active.id === "custom" ? customModel : selectedModel,
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.clawbox?.testModelConnection(getProvider());
      setTestResult(result ?? { success: false, error: "API 不可用" });
    } catch (err) { setTestResult({ success: false, error: String(err) }); }
    setTesting(false);
  };

  const handleSave = async () => {
    try {
      const provider = getProvider();
      await window.clawbox?.saveModelConfig(provider);
      setAllConfigs((prev) => ({ activeId: provider.id, providers: { ...prev.providers, [provider.id]: provider } }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      window.dispatchEvent(new CustomEvent("clawbox-config-changed"));
    } catch { /* */ }
  };

  const isValid = apiKey.trim() && (active.id !== "custom" || (baseUrlOverride.trim() && customModel.trim()));
  const currentPricing = active.pricing[selectedModel];

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
            className="relative bg-white rounded-3xl w-[560px] max-h-[80vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-[14px] font-medium text-neutral-700">模型配置</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">选择并配置 AI 模型供应商</div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-400 transition-colors duration-200">
                <X size={14} />
              </motion.button>
            </div>

            {/* Content */}
            <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-3">
              {/* Provider selector — horizontal scroll */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {PROVIDERS.map((p) => {
                  const isThisConfigured = !!allConfigs.providers[p.id]?.apiKey;
                  const isThisActive = allConfigs.activeId === p.id;
                  return (
                    <motion.button
                      key={p.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSelectProvider(p.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap flex-shrink-0 ${
                        activeId === p.id
                          ? "bg-neutral-800 text-white"
                          : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      }`}
                    >
                      {p.icon && <img src={p.icon} alt="" className="w-3.5 h-3.5 rounded" />}
                      {p.name}
                      {isThisActive && <span className="w-1 h-1 rounded-full bg-emerald-400 ml-0.5" />}
                      {!isThisActive && isThisConfigured && <span className="w-1 h-1 rounded-full bg-neutral-400 ml-0.5" />}
                    </motion.button>
                  );
                })}
              </div>

              {/* Config form */}
              <div className="bg-neutral-100 rounded-2xl p-4 space-y-2">
                {/* API Key */}
                <div className="bg-white rounded-xl p-3">
                  <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
                    <Term k="API Key" /> <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-xxxxxxxxxx"
                    className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
                  />
                </div>

                {/* Custom fields */}
                {active.id === "custom" && (
                  <>
                    <div className="bg-white rounded-xl p-3">
                      <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
                        <Term k="Base URL" /> <span className="text-red-400">*</span>
                      </label>
                      <input value={baseUrlOverride} onChange={(e) => setBaseUrlOverride(e.target.value)} placeholder="https://api.example.com/v1" className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300" />
                    </div>
                    <div className="bg-white rounded-xl p-3">
                      <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">Model Name <span className="text-red-400">*</span></label>
                      <input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="model-name" className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300" />
                    </div>
                  </>
                )}

                {/* Model selector */}
                {active.id !== "custom" && active.models.length > 0 && (
                  <div className="bg-white rounded-xl p-3">
                    <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">模型</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {active.models.map((m) => (
                        <motion.button
                          key={m}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedModel(m)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors duration-200 ${
                            selectedModel === m ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                          }`}
                        >
                          {m}
                        </motion.button>
                      ))}
                    </div>
                    {currentPricing && (
                      <div className="mt-2 flex items-center gap-4 text-[10px] text-neutral-400">
                        <span>输入 <span className="font-medium text-neutral-500">{formatPrice(currentPricing.input)}</span></span>
                        <span>输出 <span className="font-medium text-neutral-500">{formatPrice(currentPricing.output)}</span></span>
                        <span className="text-[9px] text-neutral-300">元/百万 <Term k="Token">tokens</Term></span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Portal link */}
              {active.portalUrl && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openLink(active.portalUrl!)}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                    <path d="M5 3H3.5C2.67 3 2 3.67 2 4.5v4C2 9.33 2.67 10 3.5 10h4c.83 0 1.5-.67 1.5-1.5V7M7 2h3v3M5.5 6.5L10 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {active.portalLabel}
                </motion.button>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleTest} disabled={!isValid || testing} className={`text-[10px] font-medium px-3 py-1.5 rounded-lg ${isValid && !testing ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200" : "bg-neutral-100 text-neutral-300"}`}>
                  {testing ? "测试中..." : "测试连接"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={!isValid} className={`text-[10px] font-medium px-3 py-1.5 rounded-lg ${isValid ? "bg-neutral-800 text-white" : "bg-neutral-200 text-neutral-400"}`}>
                  保存并启用
                </motion.button>
                {testResult && (
                  <span className={`text-[10px] font-medium ${testResult.success ? "text-emerald-600" : "text-red-400"}`}>
                    {testResult.success ? `成功 (${testResult.latency}ms)` : testResult.error || "失败"}
                  </span>
                )}
                {saved && <span className="text-[10px] font-medium text-emerald-600">已保存</span>}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
