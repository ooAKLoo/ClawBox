import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Eye, EyeOff } from "lucide-react";
import type { ModelProvider, InstallStepStatus, InstallProgress } from "../types/global";
import clawboxIconSrc from "../assets/icons/clawbox.svg";
import iconDeepseek from "../assets/icons/deepseek.svg";
import iconQwen from "../assets/icons/qwen.svg";
import iconVolcengine from "../assets/icons/volcengine.svg";
import iconMinimax from "../assets/icons/minimax.svg";
import iconKimi from "../assets/icons/kimi.svg";

/* ── Steps (only shown after welcome) ── */
const STEPS = ["install", "model", "done"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABELS = ["环境部署", "接入模型", "准备就绪"];

const providers = [
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", icon: iconDeepseek, tag: "省心推荐" },
  { id: "qwen", name: "阿里云百炼 Qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", icon: iconQwen, tag: "稳定推荐" },
  { id: "volcengine", name: "火山方舟", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-pro-32k", icon: iconVolcengine, tag: "" },
  { id: "minimax", name: "MiniMax", baseUrl: "https://api.minimax.chat/v1", model: "abab6.5s-chat", icon: iconMinimax, tag: "最佳适配" },
  { id: "moonshot", name: "Kimi (月之暗面)", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k", icon: iconKimi, tag: "" },
  { id: "custom", name: "自定义 OpenAI Compatible", baseUrl: "", model: "", icon: null, tag: "" },
];

interface OnboardingProps {
  onComplete: () => void;
}

/* ── Install pipeline ── */
interface InstallStepInfo {
  id: string;
  label: string;
  status: InstallStepStatus;
  detail: string;
}

const INSTALL_STEPS_INIT: InstallStepInfo[] = [
  { id: "node", label: "Node.js 运行时", status: "pending", detail: "等待部署" },
  { id: "openclaw", label: "OpenClaw 引擎", status: "pending", detail: "等待部署" },
  { id: "verify", label: "运行环境验证", status: "pending", detail: "等待校验" },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  // Welcome splash vs stepped flow
  const [started, setStarted] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const step = STEPS[stepIndex];

  // Install
  const [installSteps, setInstallSteps] = useState<InstallStepInfo[]>(INSTALL_STEPS_INIT);
  const [installing, setInstalling] = useState(false);
  const [installDone, setInstallDone] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Model
  const [selectedProvider, setSelectedProvider] = useState(providers[0]);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [modelTesting, setModelTesting] = useState(false);
  const [modelTestResult, setModelTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Launch
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const launchStarted = useRef(false);

  const goNext = async () => {
    const api = window.clawbox;
    if (api && step === "model" && apiKey.trim()) {
      const provider: ModelProvider = {
        id: selectedProvider.id,
        name: selectedProvider.name,
        baseUrl: selectedProvider.baseUrl,
        apiKey,
        model: selectedProvider.model,
      };
      await api.saveModelConfig(provider).catch(() => {});
    }
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

  /* ── Install pipeline ── */
  const handleInstallProgress = useCallback((progress: InstallProgress) => {
    if (progress.log) {
      setInstallLogs((prev) => {
        const next = [...prev, progress.log!];
        return next.length > 200 ? next.slice(-200) : next;
      });
    }
    if (progress.detail) {
      setInstallSteps((prev) =>
        prev.map((s) =>
          s.id === progress.step
            ? { ...s, status: progress.status as InstallStepStatus, detail: progress.detail }
            : s
        )
      );
    }
  }, []);

  const startInstall = useCallback(async () => {
    setInstalling(true);
    setInstallError(null);
    setInstallDone(false);
    setInstallSteps(INSTALL_STEPS_INIT);
    setInstallLogs([]);

    const api = window.clawbox;
    if (!api) { setInstallError("未在桌面端运行"); setInstalling(false); return; }

    const cleanup = api.onInstallProgress(handleInstallProgress);
    try {
      const result = await api.installEnvironment();
      if (result.success) {
        setInstallDone(true);
      } else {
        setInstallError(result.errorDetail || `安装在「${result.failedStep ?? "unknown"}」步骤失败`);
      }
    } catch (err) {
      setInstallError(String(err));
    } finally {
      cleanup();
      setInstalling(false);
    }
  }, [handleInstallProgress]);

  // Click "开始部署" on welcome → enter flow + start install immediately
  const handleStartDeploy = () => {
    setStarted(true);
    startInstall();
  };

  // Auto-scroll logs
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [installLogs]);

  /* ── Model test ── */
  const testModel = async () => {
    setModelTesting(true);
    setModelTestResult(null);
    try {
      const api = window.clawbox;
      if (!api) { setModelTestResult({ success: false, error: "未在桌面端运行" }); return; }
      const provider: ModelProvider = {
        id: selectedProvider.id,
        name: selectedProvider.name,
        baseUrl: selectedProvider.baseUrl,
        apiKey,
        model: selectedProvider.model,
      };
      const result = await api.testModelConnection(provider);
      setModelTestResult(result);
      if (result.success) await api.saveModelConfig(provider);
    } catch (err) {
      setModelTestResult({ success: false, error: String(err) });
    } finally {
      setModelTesting(false);
    }
  };

  /* ── Auto-launch on "done" step ── */
  const handleLaunch = useCallback(async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      const api = window.clawbox;
      if (!api) return;
      await api.saveSecurityConfig({
        blockPublicExpose: true,
        blockShellAccess: true,
        blockFullDiskAccess: true,
        encryptCredentials: true,
        groupChatEnabled: false,
        groupChatWhitelist: [],
        promptScanEnabled: true,
      });
      const result = await api.startDaemon();
      if (result?.success) {
        setLaunched(true);
      } else {
        setLaunchError(result?.message || "Gateway 启动失败");
      }
    } catch (err) {
      setLaunchError(String(err));
    } finally {
      setLaunching(false);
    }
  }, []);

  useEffect(() => {
    if (step === "done" && !launchStarted.current) {
      launchStarted.current = true;
      const timer = setTimeout(handleLaunch, 400);
      return () => clearTimeout(timer);
    }
  }, [step, handleLaunch]);

  const handleFinish = () => {
    window.clawbox?.setOnboardingComplete(true).catch(() => {});
    localStorage.setItem("clawbox-onboarding-complete", "true");
    onComplete();
  };

  const canProceed = (): boolean => {
    switch (step) {
      case "install": return installDone;
      case "model": return apiKey.trim().length > 0;
      default: return true;
    }
  };

  /* ═══════ Render ═══════ */
  return (
    <div className="h-screen bg-white flex items-center justify-center">
      <div className="fixed top-0 left-0 right-0 h-12 titlebar-drag z-50" />
      <AnimatePresence mode="wait">
        {!started ? (
          /* ═══════ Welcome Splash ═══════ */
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-[400px] text-center"
          >
            <motion.img
              src={clawboxIconSrc}
              alt=""
              className="w-14 h-14 mx-auto mb-5"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
            >
              <div className="text-[22px] font-medium text-neutral-700 mb-2">
                一键部署，开箱即用
              </div>
              <div className="text-[11px] text-neutral-400 leading-5 mb-8">
                Node.js、OpenClaw 引擎、安全策略全部内置<br />
                无需手动安装任何依赖，点击即可完成部署
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleStartDeploy}
                className="bg-neutral-800 text-white text-[11px] font-medium px-8 py-2.5 rounded-lg"
              >
                开始部署
              </motion.button>
              <div className="mt-4">
                <button
                  onClick={handleFinish}
                  className="text-[10px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors duration-200"
                >
                  跳过引导
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          /* ═══════ Stepped Flow ═══════ */
          <motion.div
            key="steps"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            className="w-[520px] max-h-[85vh] flex flex-col"
          >
        {/* Header with progress */}
        <div className="pb-0">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[14px] font-medium text-neutral-700">ClawBox</div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleFinish}
              className="text-[10px] font-medium text-neutral-400 hover:text-neutral-600 px-2 py-1"
            >
              跳过
            </motion.button>
          </div>
          <div className="text-[10px] text-neutral-400 mb-4">
            {STEP_LABELS[stepIndex]}（{stepIndex + 1}/{STEPS.length}）
          </div>

          {/* Progress bar */}
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
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >

              {/* ═══════ Step 1: Install ═══════ */}
              {step === "install" && (
                <div className="space-y-4">
                  <motion.div
                    className="pt-2 pb-1"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
                  >
                    <div className="text-[20px] font-medium text-neutral-700 mb-2 leading-tight">
                      环境部署
                    </div>
                    <div className="text-[11px] text-neutral-400 leading-5">
                      正在自动部署运行环境，完成后即可进入下一步。
                    </div>
                  </motion.div>

                  {/* Install progress */}
                  <motion.div
                    className="bg-neutral-100 rounded-2xl p-4"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut", delay: 0.2 }}
                  >
                    <div className="space-y-2">
                      {installSteps.map((s, i) => (
                        <InstallStepRow key={s.id} step={s} index={i} />
                      ))}
                    </div>
                  </motion.div>

                  {/* Terminal logs */}
                  {installLogs.length > 0 && (
                    <div className="bg-neutral-800 rounded-xl p-3 max-h-[120px] overflow-y-auto font-mono">
                      {installLogs.map((line, i) => (
                        <div key={i} className="text-[9px] leading-4 text-neutral-400">
                          <span className="text-neutral-600 select-none">$ </span>
                          {line}
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  )}

                  {installing && (
                    <div className="flex items-center justify-center gap-2 py-1">
                      <Spinner />
                      <span className="text-[10px] text-neutral-400">
                        {installSteps.find((s) => s.status === "running")?.detail || "正在部署..."}
                      </span>
                    </div>
                  )}

                  {installDone && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#ECFDF5] rounded-xl px-4 py-3 flex items-center gap-2.5"
                    >
                      <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                        <Check size={12} className="text-[#059669]" strokeWidth={2.5} />
                      </div>
                      <span className="text-[11px] font-medium text-[#059669]">环境就绪</span>
                    </motion.div>
                  )}

                  {installError && (
                    <div className="bg-[#FFF1F2] rounded-2xl p-4">
                      <div className="text-[10px] text-[#E11D48] font-medium mb-2">部署失败</div>
                      <p className="text-[10px] text-neutral-500 mb-3">{installError}</p>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={startInstall}
                        className="bg-neutral-800 text-white text-[10px] font-medium px-4 py-2 rounded-lg"
                      >
                        重试
                      </motion.button>
                      <p className="text-[10px] text-neutral-400 mt-2">
                        内置运行时文件可能缺失，请尝试重新下载安装 ClawBox
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════ Step 2: Model ═══════ */}
              {step === "model" && (
                <div className="space-y-4">
                  <div className="pt-2 pb-1">
                    <div className="text-[20px] font-medium text-neutral-700 mb-2 leading-tight">
                      接入 AI 模型
                    </div>
                    <div className="text-[11px] text-neutral-400 leading-5">
                      选择一个模型服务商，填入 API Key 即可。密钥加密存储在本地，不会上传。
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {providers.map((p) => {
                      const isSelected = selectedProvider.id === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`rounded-xl transition-colors duration-200 ${
                            isSelected
                              ? "bg-neutral-800"
                              : "bg-neutral-100 hover:bg-neutral-200"
                          }`}
                        >
                          {/* Provider header row */}
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => { setSelectedProvider(p); setModelTestResult(null); }}
                            className="w-full text-left px-3 py-2.5 flex items-center gap-2.5"
                          >
                            {p.icon ? (
                              <img src={p.icon} alt="" className="w-5 h-5 rounded flex-shrink-0" />
                            ) : (
                              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[8px] font-bold ${
                                isSelected ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-400"
                              }`}>API</div>
                            )}
                            <span className={`text-[11px] font-medium flex-1 ${isSelected ? "text-white" : "text-neutral-700"}`}>{p.name}</span>
                            {p.tag && (
                              <span className={`text-[9px] font-medium px-2 py-0.5 rounded-lg flex-shrink-0 ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : "bg-neutral-200 text-neutral-400"
                              }`}>
                                {p.tag}
                              </span>
                            )}
                          </motion.button>

                          {/* Expand area — same card, unified background */}
                          <AnimatePresence initial={false}>
                            {isSelected && (
                              <motion.div
                                key={`expand-${p.id}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3 pt-0.5 space-y-2">
                                  {/* Custom provider fields */}
                                  {p.id === "custom" && (
                                    <>
                                      <div>
                                        <label className="text-[9px] font-medium text-neutral-500 uppercase tracking-wide mb-1 block">Base URL</label>
                                        <input
                                          type="text"
                                          value={selectedProvider.baseUrl}
                                          onChange={(e) => setSelectedProvider({ ...selectedProvider, baseUrl: e.target.value })}
                                          placeholder="https://api.example.com/v1"
                                          className="w-full bg-white/10 rounded-lg px-3 py-2 text-[11px] text-white font-medium outline-none placeholder:text-neutral-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-medium text-neutral-500 uppercase tracking-wide mb-1 block">Model</label>
                                        <input
                                          type="text"
                                          value={selectedProvider.model}
                                          onChange={(e) => setSelectedProvider({ ...selectedProvider, model: e.target.value })}
                                          placeholder="model-name"
                                          className="w-full bg-white/10 rounded-lg px-3 py-2 text-[11px] text-white font-medium outline-none placeholder:text-neutral-500"
                                        />
                                      </div>
                                    </>
                                  )}

                                  {/* API Key */}
                                  <div>
                                    <label className="text-[9px] font-medium text-neutral-500 uppercase tracking-wide mb-1 block">
                                      API Key
                                    </label>
                                    <div className="relative">
                                      <input
                                        type={showKey ? "text" : "password"}
                                        value={apiKey}
                                        onChange={(e) => { setApiKey(e.target.value); setModelTestResult(null); }}
                                        placeholder="sk-xxxxxxxxxx"
                                        className="w-full bg-white/10 rounded-lg px-3 py-2 pr-8 text-[11px] text-white font-medium outline-none placeholder:text-neutral-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors duration-200"
                                      >
                                        {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Test + result */}
                                  <div className="flex items-center gap-3">
                                    <motion.button
                                      whileTap={{ scale: 0.97 }}
                                      onClick={testModel}
                                      disabled={!apiKey.trim() || modelTesting}
                                      className={`text-[10px] font-medium px-3.5 py-1.5 rounded-lg transition-colors duration-200 ${
                                        apiKey.trim() && !modelTesting
                                          ? "bg-white text-neutral-800"
                                          : "bg-white/10 text-neutral-500"
                                      }`}
                                    >
                                      {modelTesting ? "测试中..." : "连通性测试"}
                                    </motion.button>
                                    {modelTestResult && (
                                      <span className={`text-[10px] font-medium ${modelTestResult.success ? "text-emerald-400" : "text-red-400"}`}>
                                        {modelTestResult.success ? "连接成功" : modelTestResult.error || "连接失败"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═══════ Step 3: Done ═══════ */}
              {step === "done" && (
                <div className="space-y-4">
                  {!launched ? (
                    <>
                      <div className="pt-2 pb-1">
                        <div className="text-[20px] font-medium text-neutral-700 mb-2 leading-tight">
                          正在启动...
                        </div>
                        <div className="text-[11px] text-neutral-400 leading-5">
                          自动应用安全策略并启动 Gateway
                        </div>
                      </div>

                      <div className="bg-neutral-100 rounded-2xl p-4 space-y-2">
                        <AutoLaunchRow label="应用安全策略" done={launching || launched} running={launching} />
                        <AutoLaunchRow label="启动 Gateway" done={launched} running={launching} />
                      </div>

                      {launching && (
                        <div className="flex items-center justify-center gap-2 py-1">
                          <Spinner />
                          <span className="text-[10px] text-neutral-400">正在启动服务...</span>
                        </div>
                      )}

                      {launchError && (
                        <div className="bg-[#FFF1F2] rounded-2xl p-4">
                          <div className="text-[10px] text-[#E11D48] font-medium mb-2">启动失败</div>
                          <p className="text-[10px] text-neutral-500 mb-3">{launchError}</p>
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => { launchStarted.current = false; handleLaunch(); }}
                            className="bg-neutral-800 text-white text-[10px] font-medium px-4 py-2 rounded-lg"
                          >
                            重试
                          </motion.button>
                        </div>
                      )}
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <div className="pt-2 pb-1">
                        <div className="text-[20px] font-medium text-neutral-700 mb-2 leading-tight">
                          一切就绪
                        </div>
                        <div className="text-[11px] text-neutral-400 leading-5">
                          环境已部署、模型已接入、安全策略已启用、Gateway 已启动。
                        </div>
                      </div>

                      <div className="bg-[#ECFDF5] rounded-2xl p-5 mt-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center flex-shrink-0">
                            <Check size={20} className="text-[#059669]" strokeWidth={2.5} />
                          </div>
                          <div>
                            <div className="text-[12px] font-medium text-[#059669]">ClawBox 已上线</div>
                            <div className="text-[10px] text-[#059669]/60 mt-0.5">现在可以配置通道、创建助手了</div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {[
                            "Node.js + OpenClaw 引擎",
                            `${selectedProvider.name} 模型`,
                            "安全策略（最高防护）",
                            "Gateway 本地服务",
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Check size={10} className="text-[#059669] flex-shrink-0" strokeWidth={2.5} />
                              <span className="text-[10px] text-[#059669]/80">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="pt-6 pb-2 flex items-center justify-between">
          <div>
            {stepIndex > 0 && step !== "done" && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={goPrev}
                className="text-[10px] font-medium text-neutral-400 hover:text-neutral-600 px-3 py-1.5"
              >
                上一步
              </motion.button>
            )}
          </div>
          <div>
            {step === "done" ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleFinish}
                disabled={!launched}
                className={`text-[10px] font-medium px-5 py-2 rounded-lg transition-colors duration-200 ${
                  launched ? "bg-neutral-800 text-white" : "bg-neutral-200 text-neutral-400"
                }`}
              >
                开始使用
              </motion.button>
            ) : step === "install" && !installDone ? null : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={goNext}
                disabled={!canProceed()}
                className={`text-[10px] font-medium px-5 py-2 rounded-lg transition-colors duration-200 ${
                  canProceed() ? "bg-neutral-800 text-white" : "bg-neutral-200 text-neutral-400"
                }`}
              >
                下一步
              </motion.button>
            )}
          </div>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ── */

function InstallStepRow({ step, index }: { step: InstallStepInfo; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay: 0.3 + index * 0.08 }}
      className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-3"
    >
      <StepStatusIcon status={step.status} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-neutral-700">{step.label}</div>
        <div className={`text-[9px] mt-0.5 ${
          step.status === "error" ? "text-red-400" :
          step.status === "done" ? "text-[#059669]" :
          "text-neutral-400"
        }`}>
          {step.detail}
        </div>
      </div>
    </motion.div>
  );
}

function AutoLaunchRow({ label, done, running }: { label: string; done: boolean; running: boolean }) {
  return (
    <div className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-3">
      {done ? (
        <div className="w-4 h-4 rounded-full bg-[#ECFDF5] flex items-center justify-center flex-shrink-0">
          <Check size={9} className="text-[#059669]" strokeWidth={3} />
        </div>
      ) : running ? (
        <Spinner />
      ) : (
        <div className="w-4 h-4 rounded-full bg-neutral-200 flex-shrink-0" />
      )}
      <span className={`text-[11px] font-medium ${done ? "text-[#059669]" : "text-neutral-700"}`}>{label}</span>
    </div>
  );
}

function StepStatusIcon({ status }: { status: InstallStepStatus }) {
  switch (status) {
    case "done":
      return (
        <div className="w-4 h-4 rounded-full bg-[#ECFDF5] flex items-center justify-center flex-shrink-0">
          <Check size={9} className="text-[#059669]" strokeWidth={3} />
        </div>
      );
    case "running":
      return <Spinner />;
    case "error":
      return (
        <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <span className="text-red-400 text-[8px] font-bold">!</span>
        </div>
      );
    default:
      return <div className="w-4 h-4 rounded-full bg-neutral-200 flex-shrink-0" />;
  }
}

function Spinner() {
  return (
    <div className="w-4 h-4 flex-shrink-0">
      <motion.div
        className="w-4 h-4 rounded-full"
        style={{ border: "2px solid #e5e5e5", borderTopColor: "#404040" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      />
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
