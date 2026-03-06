import { useState, useEffect } from "react";
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

const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: iconDeepseek,
    desc: "国内认知度高，性价比好，适合尝鲜用户",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    tag: "省心推荐",
    portalUrl: "https://platform.deepseek.com/api_keys",
    portalLabel: "打开 DeepSeek 开放平台",
  },
  {
    id: "qwen",
    name: "阿里云百炼 Qwen",
    icon: iconQwen,
    desc: "稳定性好，企业级文档完整，有 OpenClaw 专门适配",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-turbo", "qwen-max"],
    tag: "稳定推荐",
    portalUrl: "https://bailian.console.aliyun.com/",
    portalLabel: "打开阿里云百炼控制台",
  },
  {
    id: "volcengine",
    name: "火山方舟",
    icon: iconVolcengine,
    desc: "字节系生态，飞书周边场景有协同感",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: ["doubao-pro-32k", "doubao-lite-32k"],
    tag: "备选",
    portalUrl: "https://console.volcengine.com/ark",
    portalLabel: "打开火山方舟控制台",
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    icon: iconSiliconflow,
    desc: "模型选择多，开发者生态成熟",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"],
    tag: "",
    portalUrl: "https://cloud.siliconflow.cn/account/ak",
    portalLabel: "打开硅基流动控制台",
  },
  {
    id: "hunyuan",
    name: "腾讯混元",
    icon: iconHunyuan,
    desc: "腾讯体系内用户熟悉",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    models: ["hunyuan-pro", "hunyuan-standard"],
    tag: "",
    portalUrl: "https://hunyuan.tencent.com/bot/chat",
    portalLabel: "打开腾讯混元平台",
  },
  {
    id: "minimax",
    name: "MiniMax",
    icon: iconMinimax,
    desc: "擅长长文本和语音生成，MoE 架构性价比高",
    baseUrl: "https://api.minimax.chat/v1",
    models: ["MiniMax-Text-01", "abab6.5s-chat"],
    tag: "",
    portalUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    portalLabel: "打开 MiniMax 开放平台",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    icon: iconZhipu,
    desc: "清华系团队，GLM 系列模型能力全面",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4-plus", "glm-4-flash", "glm-4"],
    tag: "",
    portalUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    portalLabel: "打开智谱开放平台",
  },
  {
    id: "kimi",
    name: "Kimi (月之暗面)",
    icon: iconKimi,
    desc: "长上下文能力突出，擅长文档理解与总结",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-auto", "moonshot-v1-32k", "moonshot-v1-128k"],
    tag: "",
    portalUrl: "https://platform.moonshot.cn/console/api-keys",
    portalLabel: "打开 Moonshot 开放平台",
  },
  {
    id: "custom",
    name: "自定义 OpenAI Compatible",
    icon: null,
    desc: "任意兼容 OpenAI API 的供应商",
    baseUrl: "",
    models: [],
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

export default function Model() {
  const [activeId, setActiveId] = useState("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const active = PROVIDERS.find((p) => p.id === activeId)!;

  useEffect(() => {
    setApiKey("");
    setTestResult(null);
    setSaved(false);
    if (active.models.length > 0) {
      setSelectedModel(active.models[0]);
    } else {
      setSelectedModel("");
    }
  }, [activeId]);

  useEffect(() => {
    (async () => {
      try {
        const config = await window.clawbox?.getModelConfig();
        if (config) {
          setActiveId(config.id);
          setApiKey(config.apiKey);
          if (config.id === "custom") {
            setCustomBaseUrl(config.baseUrl);
            setCustomModel(config.model);
          } else {
            setSelectedModel(config.model);
          }
        }
      } catch {
        // ok
      }
    })();
  }, []);

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
      await window.clawbox?.saveModelConfig(getProvider());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // handle
    }
  };

  const isValid = apiKey.trim() && (active.id !== "custom" || (customBaseUrl.trim() && customModel.trim()));

  return (
    <div className="flex gap-4 h-full">
      {/* Left — provider list */}
      <div className="w-52 flex-shrink-0 space-y-1">
        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
          模型供应商
        </div>
        {PROVIDERS.map((p) => (
          <motion.button
            key={p.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveId(p.id)}
            className={`w-full text-left rounded-xl p-3 relative ${
              activeId === p.id ? "" : "hover:bg-neutral-50"
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
              <span className={`text-[11px] font-medium transition-colors duration-200 flex-1 min-w-0 truncate ${
                activeId === p.id ? "text-neutral-700" : "text-neutral-500"
              }`}>
                {p.name}
              </span>
              {p.tag && (
                <span className="text-[8px] font-medium text-neutral-400 bg-neutral-200 px-1.5 py-0.5 rounded flex-shrink-0">
                  {p.tag}
                </span>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Right — config form */}
      <div className="flex-1 min-w-0">
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
                <path d="M5 3H3.5C2.67 3 2 3.67 2 4.5v4C2 9.33 2.67 10 3.5 10h4c.83 0 1.5-.67 1.5-1.5V7M7 2h3v3M5.5 6.5L10 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
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
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors duration-200 ${
                      selectedModel === m
                        ? "bg-neutral-800 text-white"
                        : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                    }`}
                  >
                    {m}
                  </motion.button>
                ))}
              </div>
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
            className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
              isValid && !testing
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
            className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
              isValid
                ? "bg-neutral-800 text-white"
                : "bg-neutral-200 text-neutral-400"
            }`}
          >
            保存配置
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
