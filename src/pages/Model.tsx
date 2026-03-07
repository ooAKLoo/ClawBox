import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { ModelProvider } from "../types/global";

import iconDeepseek from "../assets/icons/deepseek.svg";
import iconQwen from "../assets/icons/qwen.svg";
import iconVolcengine from "../assets/icons/volcengine.svg";
import iconSiliconflow from "../assets/icons/siliconflow.svg";
import iconHunyuan from "../assets/icons/hunyuan.svg";
import iconMinimax from "../assets/icons/minimax.svg";
import iconZhipu from "../assets/icons/zhipu.svg";
import iconKimi from "../assets/icons/kimi.svg";
import iconStepfun from "../assets/icons/stepfun.svg";

/** 价格单位：元 / 百万 tokens */
const PRICE_UPDATED = "2026-03";

type ModelPricing = { input: number; output: number; note?: string };

const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: iconDeepseek,
    desc: "国内认知度高，性价比好，当前都对应 DeepSeek-V3.2",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    pricing: {
      "deepseek-chat": { input: 2, output: 3, note: "缓存命中输入 ¥0.2/M" },
      "deepseek-reasoner": { input: 2, output: 3, note: "缓存命中输入 ¥0.2/M" },
    } as Record<string, ModelPricing>,
    tag: "省心推荐",
    portalUrl: "https://platform.deepseek.com/api_keys",
    portalLabel: "打开 DeepSeek 开放平台",
  },
  {
    id: "qwen",
    name: "阿里云百炼 Qwen",
    icon: iconQwen,
    desc: "稳定性好，企业级文档完整，中国内地/全球部署同价",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen3-next-80b-a3b-instruct", "qwen3-next-80b-a3b-thinking"],
    pricing: {
      "qwen3-next-80b-a3b-instruct": { input: 1, output: 4 },
      "qwen3-next-80b-a3b-thinking": { input: 1, output: 10, note: "思考模式输出更贵" },
    } as Record<string, ModelPricing>,
    tag: "稳定推荐",
    portalUrl: "https://bailian.console.aliyun.com/cn-beijing/?tab=model#/api-key",
    portalLabel: "打开阿里云百炼控制台",
  },
  {
    id: "stepfun",
    name: "阶跃星辰",
    icon: iconStepfun,
    desc: "多模态能力强，Step 系列性价比突出",
    baseUrl: "https://api.stepfun.com/v1",
    models: ["step-3.5-flash", "step-3"],
    pricing: {
      "step-3.5-flash": { input: 0.7, output: 2.1, note: "缓存命中输入 ¥0.14/M" },
      "step-3": { input: 4, output: 16 },
    } as Record<string, ModelPricing>,
    tag: "",
    portalUrl: "https://platform.stepfun.com/",
    portalLabel: "打开阶跃星辰开放平台",
  },
  {
    id: "minimax",
    name: "MiniMax",
    icon: iconMinimax,
    desc: "擅长长文本和语音生成，MoE 架构性价比高",
    baseUrl: "https://api.minimax.chat/v1",
    models: ["MiniMax-M2.5", "MiniMax-M2.5-highspeed"],
    pricing: {
      "MiniMax-M2.5": { input: 2.1, output: 8.4 },
      "MiniMax-M2.5-highspeed": { input: 4.2, output: 16.8 },
    } as Record<string, ModelPricing>,
    tag: "",
    portalUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    portalLabel: "打开 MiniMax 开放平台",
  },
  {
    id: "hunyuan",
    name: "腾讯混元",
    icon: iconHunyuan,
    desc: "腾讯体系内用户熟悉，HY 2.0 系列",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    models: ["hunyuan-2.0-instruct", "hunyuan-2.0-think"],
    pricing: {
      "hunyuan-2.0-instruct": { input: 3.18, output: 7.95, note: "32k 内；32-128k 涨至 4.5/11.9" },
      "hunyuan-2.0-think": { input: 3.975, output: 15.9, note: "32k 内；32-128k 涨至 5.3/21.2" },
    } as Record<string, ModelPricing>,
    tag: "",
    portalUrl: "https://hunyuan.tencent.com/bot/chat",
    portalLabel: "打开腾讯混元平台",
  },
  {
    id: "kimi",
    name: "Kimi (月之暗面)",
    icon: iconKimi,
    desc: "长上下文能力突出，262k 上下文窗口",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["kimi-k2-0905-preview"],
    pricing: {
      "kimi-k2-0905-preview": { input: 4, output: 16, note: "缓存命中输入 ¥1/M" },
    } as Record<string, ModelPricing>,
    tag: "",
    portalUrl: "https://platform.moonshot.cn/console/api-keys",
    portalLabel: "打开 Moonshot 开放平台",
  },
  {
    id: "volcengine",
    name: "火山方舟",
    icon: iconVolcengine,
    desc: "字节系生态，豆包 Seed 系列模型",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: ["Doubao-Seed-2.0-pro-260215", "Doubao-Seed-2.0-lite-260215", "Doubao-Seed-1.6-vision-250815"],
    pricing: {
      "Doubao-Seed-2.0-pro-260215": { input: 3.2, output: 16, note: "≤32k；缓存命中 ¥0.64/M" },
      "Doubao-Seed-2.0-lite-260215": { input: 0.6, output: 3.6, note: "≤32k；缓存命中 ¥0.12/M" },
      "Doubao-Seed-1.6-vision-250815": { input: 0.8, output: 8, note: "≤32k；多模态；缓存命中 ¥0.16/M" },
    } as Record<string, ModelPricing>,
    tag: "",
    portalUrl: "https://console.volcengine.com/ark",
    portalLabel: "打开火山方舟控制台",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    icon: iconZhipu,
    desc: "清华系团队，GLM-5 旗舰即将推出",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4.6v"],
    pricing: {
      "glm-4.6v": { input: 1, output: 3, note: "GLM-5 / GLM-5-Code 标记 Coming soon" },
    } as Record<string, ModelPricing>,
    tag: "",
    portalUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    portalLabel: "打开智谱开放平台",
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    icon: iconSiliconflow,
    desc: "聚合平台，可接入 DeepSeek、GLM、Qwen 等多家模型",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: ["Step-3.5-Flash", "deepseek-ai/DeepSeek-V3.2", "zhipu-ai/GLM-4.6V", "MiniMax/MiniMax-M2.5"],
    pricing: {
      "Step-3.5-Flash": { input: 0.7, output: 2.1 },
      "deepseek-ai/DeepSeek-V3.2": { input: 2, output: 3 },
      "zhipu-ai/GLM-4.6V": { input: 1, output: 3 },
      "MiniMax/MiniMax-M2.5": { input: 2.1, output: 8.4 },
    } as Record<string, ModelPricing>,
    tag: "聚合",
    portalUrl: "https://cloud.siliconflow.cn/account/ak",
    portalLabel: "打开硅基流动控制台",
  },
  {
    id: "custom",
    name: "自定义 OpenAI Compatible",
    icon: null,
    desc: "任意兼容 OpenAI API 的供应商",
    baseUrl: "",
    models: [],
    pricing: {} as Record<string, ModelPricing>,
    tag: "",
    portalUrl: null,
    portalLabel: null,
  },
];

const openLink = async (url: string) => {
  try {
    if (window.clawbox?.openExternal) {
      await window.clawbox.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  } catch {
    window.open(url, "_blank");
  }
};

const formatPrice = (price: number) => `¥${price}`;

export default function Model() {
  const [activeId, setActiveId] = useState("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [allConfigs, setAllConfigs] = useState<{ activeId: string | null; providers: Record<string, ModelProvider> }>({ activeId: null, providers: {} });
  const initialLoadRef = useRef(false);

  const active = PROVIDERS.find((p) => p.id === activeId)!;

  // Load all saved configs on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await window.clawbox?.getAllModelConfigs();
        if (data) {
          setAllConfigs(data);
          if (data.activeId && data.providers[data.activeId]) {
            const cfg = data.providers[data.activeId];
            setActiveId(cfg.id);
            setApiKey(cfg.apiKey);
            if (cfg.id === "custom") {
              setCustomBaseUrl(cfg.baseUrl);
              setCustomModel(cfg.model);
            } else {
              setSelectedModel(cfg.model);
            }
          }
        }
      } catch {
        // ok
      } finally {
        initialLoadRef.current = true;
      }
    })();
  }, []);

  // When user clicks a different provider in the sidebar
  const handleSelectProvider = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    setTestResult(null);
    setSaved(false);

    const savedCfg = allConfigs.providers[id];
    if (savedCfg?.apiKey) {
      setApiKey(savedCfg.apiKey);
      if (id === "custom") {
        setCustomBaseUrl(savedCfg.baseUrl);
        setCustomModel(savedCfg.model);
      } else {
        setSelectedModel(savedCfg.model || PROVIDERS.find((p) => p.id === id)?.models[0] || "");
      }
    } else {
      setApiKey("");
      const provider = PROVIDERS.find((p) => p.id === id)!;
      setSelectedModel(provider.models[0] || "");
      if (id === "custom") {
        setCustomBaseUrl("");
        setCustomModel("");
      }
    }
  };

  const getProvider = (): ModelProvider => ({
    id: active.id,
    name: active.name,
    baseUrl: active.id === "custom" ? customBaseUrl : active.baseUrl,
    apiKey,
    model: active.id === "custom" ? customModel : selectedModel,
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.clawbox?.testModelConnection(getProvider());
      setTestResult(result ?? { success: false, error: "API 不可用" });
    } catch (err) {
      setTestResult({ success: false, error: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      const provider = getProvider();
      await window.clawbox?.saveModelConfig(provider);
      setAllConfigs((prev) => ({
        activeId: provider.id,
        providers: { ...prev.providers, [provider.id]: provider },
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Notify other pages (Dashboard) to refresh
      window.dispatchEvent(new CustomEvent("clawbox-config-changed"));
    } catch {
      // handle
    }
  };

  const isValid = apiKey.trim() && (active.id !== "custom" || (customBaseUrl.trim() && customModel.trim()));
  const currentPricing = active.pricing[selectedModel];

  return (
    <div className="flex gap-4 h-full">
      {/* Left — provider list */}
      <div className="w-52 flex-shrink-0 space-y-1 overflow-y-auto">
        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
          模型供应商
        </div>
        {PROVIDERS.map((p) => {
          const isConfigured = !!allConfigs.providers[p.id]?.apiKey;
          const isActive = allConfigs.activeId === p.id;
          return (
            <motion.button
              key={p.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectProvider(p.id)}
              className={`w-full text-left rounded-xl p-3 relative ${activeId === p.id ? "" : "hover:bg-neutral-50"
                }`}
            >
              {activeId === p.id && (
                <motion.div
                  layoutId="model-provider-active"
                  className="absolute inset-0 bg-neutral-100 rounded-xl"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <div className="relative z-[1] flex items-center gap-2.5">
                {p.icon ? (
                  <img src={p.icon} alt={p.name} className="w-5 h-5 flex-shrink-0 rounded" />
                ) : (
                  <div className="w-5 h-5 flex-shrink-0 rounded bg-neutral-200 flex items-center justify-center text-[9px] text-neutral-400 font-bold">?</div>
                )}
                <span className={`text-[11px] font-medium transition-colors duration-200 flex-1 min-w-0 truncate ${activeId === p.id ? "text-neutral-700" : "text-neutral-500"
                  }`}>
                  {p.name}
                </span>
                {isActive ? (
                  <span className="text-[8px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex-shrink-0">
                    使用中
                  </span>
                ) : isConfigured ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                ) : p.tag ? (
                  <span className="text-[8px] font-medium text-neutral-400 bg-neutral-200 px-1.5 py-0.5 rounded flex-shrink-0">
                    {p.tag}
                  </span>
                ) : null}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Right — config form */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
          配置
        </div>

        <div className="flex items-center gap-3 mb-1">
          <div className="text-[14px] font-medium text-neutral-700">{active.name}</div>
          {active.portalUrl && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => openLink(active.portalUrl!)}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-[#2563EB] bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors duration-200"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                <path d="M5 3H3.5C2.67 3 2 3.67 2 4.5v4C2 9.33 2.67 10 3.5 10h4c.83 0 1.5-.67 1.5-1.5V7M7 2h3v3M5.5 6.5L10 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {active.portalLabel}
            </motion.button>
          )}
        </div>
        <p className="text-[10px] text-neutral-400 mb-4">{active.desc}</p>

        <div className="bg-neutral-100 rounded-2xl p-4 space-y-3">
          {/* API Key */}
          <div className="bg-white rounded-xl p-3">
            <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
              API Key <span className="text-red-400">*</span>
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
                  Base URL <span className="text-red-400">*</span>
                </label>
                <input
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
                />
              </div>
              <div className="bg-white rounded-xl p-3">
                <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
                  Model Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="model-name"
                  className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
                />
              </div>
            </>
          )}

          {/* Model selector */}
          {active.id !== "custom" && active.models.length > 0 && (
            <div className="bg-white rounded-xl p-3">
              <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
                模型
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {active.models.map((m) => (
                  <motion.button
                    key={m}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedModel(m)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors duration-200 ${selectedModel === m
                        ? "bg-neutral-800 text-white"
                        : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      }`}
                  >
                    {m}
                  </motion.button>
                ))}
              </div>

              {/* Pricing for selected model */}
              {currentPricing && (
                <div className="mt-2.5 space-y-1">
                  <div className="flex items-center gap-4 text-[10px] text-neutral-400">
                    <span>
                      输入 <span className="font-medium text-neutral-500">{formatPrice(currentPricing.input)}</span>
                    </span>
                    <span>
                      输出 <span className="font-medium text-neutral-500">{formatPrice(currentPricing.output)}</span>
                    </span>
                    <span className="text-[9px] text-neutral-300">元/百万 tokens</span>
                  </div>
                  {currentPricing.note && (
                    <p className="text-[9px] text-neutral-300">{currentPricing.note}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pricing table */}
          {active.id !== "custom" && Object.keys(active.pricing).length > 0 && (
            <div className="bg-white rounded-xl p-3">
              <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2 block">
                价格一览 <span className="text-neutral-300 normal-case">({PRICE_UPDATED} 更新)</span>
              </label>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-neutral-400 text-left">
                    <th className="font-medium pb-1.5">模型</th>
                    <th className="font-medium pb-1.5 text-right">输入 (元/M)</th>
                    <th className="font-medium pb-1.5 text-right">输出 (元/M)</th>
                    <th className="font-medium pb-1.5 pl-3">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {active.models.map((m) => {
                    const p = active.pricing[m];
                    if (!p) return null;
                    return (
                      <tr
                        key={m}
                        className={selectedModel === m ? "text-neutral-700" : "text-neutral-400"}
                      >
                        <td className="py-1 font-medium font-mono">{m}</td>
                        <td className="py-1 text-right">{formatPrice(p.input)}</td>
                        <td className="py-1 text-right">{formatPrice(p.output)}</td>
                        <td className="py-1 pl-3 text-[9px] text-neutral-300">{p.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {active.portalUrl && (
                <button
                  onClick={() => openLink(active.portalUrl!)}
                  className="text-[9px] text-neutral-300 hover:text-neutral-400 mt-1.5 transition-colors duration-200"
                >
                  以官方最新定价为准 →
                </button>
              )}
            </div>
          )}

          {/* Base URL (read-only for preset) */}
          {active.id !== "custom" && (
            <div className="bg-white rounded-xl p-3">
              <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
                Base URL
              </label>
              <div className="text-[10px] text-neutral-400 font-mono bg-neutral-50 rounded-lg px-3 py-2">
                {active.baseUrl}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleTest}
            disabled={!isValid || testing}
            className={`text-[10px] font-medium px-4 py-2 rounded-lg ${isValid && !testing
                ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                : "bg-neutral-100 text-neutral-300"
              }`}
          >
            {testing ? "测试中..." : "连通性测试"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={!isValid}
            className={`text-[10px] font-medium px-4 py-2 rounded-lg ${isValid
                ? "bg-neutral-800 text-white"
                : "bg-neutral-200 text-neutral-400"
              }`}
          >
            保存并启用
          </motion.button>
          {testResult && (
            <span className={`text-[10px] font-medium ${testResult.success ? "text-emerald-600" : "text-red-400"}`}>
              {testResult.success
                ? `连接成功 (${testResult.latency}ms)`
                : testResult.error || "连接失败"}
            </span>
          )}
          {saved && <span className="text-[10px] font-medium text-emerald-600">已保存</span>}
        </div>
      </div>
    </div>
  );
}
