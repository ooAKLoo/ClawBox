import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ModelProvider } from "../types/global";

const STEPS = [
  "welcome",
  "envCheck",
  "selectProvider",
  "apiKey",
  "feishu",
  "security",
  "launch",
  "testMessage",
] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS = [
  "欢迎",
  "环境检查",
  "选择模型",
  "API Key",
  "飞书接入",
  "权限确认",
  "启动",
  "测试消息",
];

const providers = [
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", tag: "省心推荐" },
  { id: "qwen", name: "阿里云百炼 Qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", tag: "稳定推荐" },
  { id: "volcengine", name: "火山方舟", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-pro-32k", tag: "备选" },
  { id: "custom", name: "自定义 OpenAI Compatible", baseUrl: "", model: "", tag: "" },
];

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const step = STEPS[stepIndex];

  // State
  const [envStatus, setEnvStatus] = useState<{ node: boolean; openclaw: boolean; checking: boolean }>({
    node: false, openclaw: false, checking: false,
  });
  const [selectedProvider, setSelectedProvider] = useState(providers[0]);
  const [apiKey, setApiKey] = useState("");
  const [modelTesting, setModelTesting] = useState(false);
  const [modelTestResult, setModelTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [feishuConfig, setFeishuConfig] = useState({ appId: "", appSecret: "" });
  const [feishuTesting, setFeishuTesting] = useState(false);
  const [feishuResult, setFeishuResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [testMsg, setTestMsg] = useState("你好，ClawBox 测试消息");
  const [testSent, setTestSent] = useState(false);

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setDirection(1);
      setStepIndex(stepIndex + 1);
    }
  };
  const goPrev = () => {
    if (stepIndex > 0) {
      setDirection(-1);
      setStepIndex(stepIndex - 1);
    }
  };

  const checkEnv = async () => {
    setEnvStatus({ node: false, openclaw: false, checking: true });
    try {
      const api = window.clawbox;
      if (!api) {
        setEnvStatus({ node: false, openclaw: false, checking: false });
        return;
      }
      const [node, claw] = await Promise.all([api.checkNode(), api.checkOpenClaw()]);
      setEnvStatus({ node: node.installed, openclaw: claw.installed, checking: false });
    } catch {
      setEnvStatus({ node: false, openclaw: false, checking: false });
    }
  };

  const testModel = async () => {
    setModelTesting(true);
    setModelTestResult(null);
    try {
      const api = window.clawbox;
      if (!api) {
        setModelTestResult({ success: false, error: "未在桌面端运行" });
        return;
      }
      const provider: ModelProvider = {
        id: selectedProvider.id,
        name: selectedProvider.name,
        baseUrl: selectedProvider.baseUrl,
        apiKey,
        model: selectedProvider.model,
      };
      const result = await api.testModelConnection(provider);
      setModelTestResult(result);
      if (result.success) {
        await api.saveModelConfig(provider);
      }
    } catch (err) {
      setModelTestResult({ success: false, error: String(err) });
    } finally {
      setModelTesting(false);
    }
  };

  const testFeishu = async () => {
    setFeishuTesting(true);
    setFeishuResult(null);
    try {
      const api = window.clawbox;
      if (!api) return;
      await api.saveFeishuConfig({
        appId: feishuConfig.appId,
        appSecret: feishuConfig.appSecret,
        verificationToken: "",
        encryptKey: "",
      });
      const result = await api.testFeishuConnection();
      setFeishuResult(result);
    } catch (err) {
      setFeishuResult({ success: false, error: String(err) });
    } finally {
      setFeishuTesting(false);
    }
  };

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const api = window.clawbox;
      if (!api) return;
      await api.saveSecurityConfig({
        toolsProfile: "messaging",
        blockPublicExpose: true,
        blockShellAccess: true,
        blockFullDiskAccess: true,
        skillWhitelist: true,
        encryptCredentials: true,
        lockStableChannel: true,
        groupChatEnabled: false,
        groupChatWhitelist: [],
      });
      await api.startDaemon();
      setLaunched(true);
    } catch {
      // handle error
    } finally {
      setLaunching(false);
    }
  };

  const handleTestMessage = async () => {
    try {
      const api = window.clawbox;
      if (!api) return;
      await api.sendTestMessage(testMsg);
      setTestSent(true);
    } catch {
      // handle
    }
  };

  const handleFinish = async () => {
    try {
      await window.clawbox?.setOnboardingComplete(true);
    } catch {
      // ok
    }
    onComplete();
  };

  const canProceed = (): boolean => {
    switch (step) {
      case "envCheck": return envStatus.node;
      case "apiKey": return apiKey.trim().length > 0;
      case "feishu": return feishuConfig.appId.trim().length > 0 && feishuConfig.appSecret.trim().length > 0;
      default: return true;
    }
  };

  return (
    <div className="h-screen bg-[#f8f8f8] flex items-center justify-center">
      <div className="bg-white rounded-3xl w-[640px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="text-[14px] font-medium text-neutral-700 mb-1">ClawBox 初始设置</div>
          <div className="text-[11px] text-neutral-400 mb-4">
            {STEP_LABELS[stepIndex]}（{stepIndex + 1}/{STEPS.length}）
          </div>

          {/* Step indicators */}
          <div className="flex gap-1 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i <= stepIndex ? "bg-neutral-800" : "bg-neutral-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {step === "welcome" && (
                <div className="py-8 text-center">
                  <div className="text-[40px] mb-4">🦞</div>
                  <div className="text-[14px] font-medium text-neutral-700 mb-2">
                    欢迎使用 ClawBox
                  </div>
                  <div className="text-[11px] text-neutral-500 leading-5 max-w-md mx-auto">
                    OpenClaw 飞书安全桌面版。接下来的几个步骤将帮助你完成环境配置、模型接入、飞书连接和安全设置。
                  </div>
                </div>
              )}

              {step === "envCheck" && (
                <div className="space-y-3">
                  <div className="bg-neutral-100 rounded-2xl p-4 space-y-2">
                    <CheckItem label="Node.js 22+" checked={envStatus.node} />
                    <CheckItem label="OpenClaw" checked={envStatus.openclaw} />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={checkEnv}
                    disabled={envStatus.checking}
                    className="bg-neutral-800 text-white text-[10px] font-medium px-4 py-2 rounded-lg"
                  >
                    {envStatus.checking ? "检测中..." : "开始检测"}
                  </motion.button>
                  {!envStatus.node && !envStatus.checking && (
                    <p className="text-[10px] text-neutral-400">
                      需要 Node.js 22+，请先安装后重新检测。
                    </p>
                  )}
                </div>
              )}

              {step === "selectProvider" && (
                <div className="space-y-2">
                  {providers.map((p) => (
                    <motion.button
                      key={p.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedProvider(p)}
                      className={`w-full text-left rounded-xl p-3 flex items-center justify-between transition-colors duration-200 ${
                        selectedProvider.id === p.id
                          ? "bg-neutral-800 text-white"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      <span className="text-[11px] font-medium">{p.name}</span>
                      {p.tag && (
                        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-lg ${
                          selectedProvider.id === p.id
                            ? "bg-white/20 text-white"
                            : "bg-neutral-200 text-neutral-400"
                        }`}>
                          {p.tag}
                        </span>
                      )}
                    </motion.button>
                  ))}
                  {selectedProvider.id === "custom" && (
                    <div className="bg-neutral-100 rounded-2xl p-3 space-y-2 mt-2">
                      <InputField
                        label="Base URL"
                        value={selectedProvider.baseUrl}
                        onChange={(v) => setSelectedProvider({ ...selectedProvider, baseUrl: v })}
                        placeholder="https://api.example.com/v1"
                      />
                      <InputField
                        label="Model"
                        value={selectedProvider.model}
                        onChange={(v) => setSelectedProvider({ ...selectedProvider, model: v })}
                        placeholder="model-name"
                      />
                    </div>
                  )}
                </div>
              )}

              {step === "apiKey" && (
                <div className="space-y-3">
                  <div className="bg-neutral-100 rounded-2xl p-4">
                    <div className="text-[11px] font-medium text-neutral-700 mb-1">
                      {selectedProvider.name}
                    </div>
                    <p className="text-[10px] text-neutral-400 mb-3">
                      请填写 API Key，将加密存储在本地。
                    </p>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-xxxxxxxxxx"
                      className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={testModel}
                      disabled={!apiKey.trim() || modelTesting}
                      className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
                        apiKey.trim() && !modelTesting
                          ? "bg-neutral-800 text-white"
                          : "bg-neutral-200 text-neutral-400"
                      }`}
                    >
                      {modelTesting ? "测试中..." : "连通性测试"}
                    </motion.button>
                    {modelTestResult && (
                      <span className={`text-[10px] font-medium ${modelTestResult.success ? "text-emerald-600" : "text-red-400"}`}>
                        {modelTestResult.success ? "连接成功" : modelTestResult.error || "连接失败"}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {step === "feishu" && (
                <div className="space-y-3">
                  <div className="bg-[#EFF6FF] rounded-2xl p-4">
                    <div className="text-[9px] font-medium text-[#2563EB] uppercase tracking-wide mb-2">
                      飞书配置指引
                    </div>
                    <ol className="space-y-1">
                      {[
                        "在飞书开放平台创建企业自建应用",
                        "开启机器人能力",
                        "配置事件订阅（选择长连接 WebSocket）",
                        "订阅 im.message.receive_v1 事件",
                        "发布应用版本",
                      ].map((t, i) => (
                        <li key={i} className="text-[10px] text-neutral-500 flex items-start gap-2">
                          <span className="text-[#2563EB] font-medium">{i + 1}.</span>{t}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="bg-neutral-100 rounded-2xl p-4 space-y-2">
                    <InputField
                      label="App ID"
                      value={feishuConfig.appId}
                      onChange={(v) => setFeishuConfig((c) => ({ ...c, appId: v }))}
                      placeholder="cli_xxxxxxxxxx"
                    />
                    <InputField
                      label="App Secret"
                      value={feishuConfig.appSecret}
                      onChange={(v) => setFeishuConfig((c) => ({ ...c, appSecret: v }))}
                      placeholder="xxxxxxxxxxxxxxxx"
                      type="password"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={testFeishu}
                      disabled={!feishuConfig.appId || !feishuConfig.appSecret || feishuTesting}
                      className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
                        feishuConfig.appId && feishuConfig.appSecret && !feishuTesting
                          ? "bg-neutral-800 text-white"
                          : "bg-neutral-200 text-neutral-400"
                      }`}
                    >
                      {feishuTesting ? "验证中..." : "验证连接"}
                    </motion.button>
                    {feishuResult && (
                      <span className={`text-[10px] font-medium ${feishuResult.success ? "text-emerald-600" : "text-red-400"}`}>
                        {feishuResult.success ? "验证通过" : feishuResult.error}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {step === "security" && (
                <div className="space-y-3">
                  <div className="bg-neutral-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium text-neutral-700">安全模式（默认）</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        "工具权限：messaging（仅消息相关）",
                        "网络：仅本机监听，不暴露公网",
                        "文件：不开放文件系统访问",
                        "Shell：不开放命令执行",
                        "插件：白名单模式，不开放市场",
                        "群聊：默认关闭，需手动添加白名单",
                        "版本：锁定 stable 通道",
                      ].map((item, i) => (
                        <div key={i} className="bg-white rounded-xl px-3 py-2 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-neutral-500">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    这些是推荐的安全默认配置。安装完成后可在「权限与安全」页面调整。
                  </p>
                </div>
              )}

              {step === "launch" && (
                <div className="py-6 text-center space-y-4">
                  {!launched ? (
                    <>
                      <div className="text-[11px] text-neutral-500 mb-4">
                        配置完成。现在启动 OpenClaw Gateway。
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleLaunch}
                        disabled={launching}
                        className="bg-neutral-800 text-white text-[10px] font-medium px-6 py-2.5 rounded-lg"
                      >
                        {launching ? "启动中..." : "启动 Gateway"}
                      </motion.button>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-emerald-500 mx-auto flex items-center justify-center">
                        <span className="text-white text-[12px]">✓</span>
                      </div>
                      <div className="text-[11px] font-medium text-neutral-700">Gateway 已启动</div>
                      <div className="text-[10px] text-neutral-400">127.0.0.1:18789</div>
                    </>
                  )}
                </div>
              )}

              {step === "testMessage" && (
                <div className="space-y-3">
                  <div className="bg-neutral-100 rounded-2xl p-4">
                    <div className="text-[11px] font-medium text-neutral-700 mb-2">
                      发送测试消息
                    </div>
                    <p className="text-[10px] text-neutral-400 mb-3">
                      通过飞书向机器人发一条消息，验证整个链路是否正常。
                    </p>
                    <input
                      value={testMsg}
                      onChange={(e) => setTestMsg(e.target.value)}
                      className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleTestMessage}
                      className="bg-neutral-800 text-white text-[10px] font-medium px-4 py-2 rounded-lg"
                    >
                      发送测试
                    </motion.button>
                    {testSent && (
                      <span className="text-[10px] font-medium text-emerald-600">已发送</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 flex items-center justify-between">
          <div>
            {stepIndex > 0 && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={goPrev}
                className="text-[10px] font-medium text-neutral-400 hover:text-neutral-600 px-3 py-1.5"
              >
                上一步
              </motion.button>
            )}
          </div>
          <div className="flex gap-2">
            {step === "envCheck" && !envStatus.node && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={goNext}
                className="text-[10px] font-medium text-neutral-400 px-3 py-1.5"
              >
                跳过
              </motion.button>
            )}
            {step === "testMessage" ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleFinish}
                className="bg-neutral-800 text-white text-[10px] font-medium px-4 py-2 rounded-lg"
              >
                完成设置
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={goNext}
                disabled={!canProceed()}
                className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
                  canProceed()
                    ? "bg-neutral-800 text-white"
                    : "bg-neutral-200 text-neutral-400"
                }`}
              >
                下一步
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="bg-white rounded-xl px-3 py-2 flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${checked ? "bg-emerald-500" : "bg-neutral-300"}`} />
      <span className={`text-[11px] font-medium ${checked ? "text-neutral-700" : "text-neutral-400"}`}>
        {label}
      </span>
      {checked && <span className="text-[9px] text-emerald-600 ml-auto">已就绪</span>}
    </div>
  );
}

function InputField({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-3">
      <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
      />
    </div>
  );
}
