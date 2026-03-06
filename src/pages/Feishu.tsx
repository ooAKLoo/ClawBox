import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const STEPS = [
  {
    key: "create",
    label: "创建应用",
    desc: "在飞书开放平台创建一个企业自建应用。进入「应用管理」→「创建应用」，选择「企业自建应用」。",
    url: "https://open.feishu.cn/app",
    urlLabel: "打开飞书开放平台 - 应用管理",
  },
  {
    key: "bot",
    label: "开启机器人",
    desc: "进入你刚创建的应用，在左侧「添加应用能力」中，添加「机器人」能力。这样应用才能在飞书中作为 Bot 发消息。",
    url: "https://open.feishu.cn/document/home/develop-a-bot-in-5-minutes/create-an-app",
    urlLabel: "查看飞书机器人开发文档",
  },
  {
    key: "event",
    label: "配置事件订阅",
    desc: "进入「事件与回调」→「事件订阅」，选择「使用长连接接收事件」（WebSocket 模式，无需公网 webhook）。然后添加事件 im.message.receive_v1。",
    url: "https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/event-subscription-guide/long-connection-event-subscription-overview",
    urlLabel: "查看长连接事件订阅文档",
  },
  {
    key: "publish",
    label: "发布应用",
    desc: "在「版本管理与发布」中创建应用版本并提交发布。如果是开发环境，可以先发布到测试企业。",
    url: "https://open.feishu.cn/document/home/introduction-to-custom-app-development/publishing",
    urlLabel: "查看应用发布文档",
  },
  {
    key: "credentials",
    label: "填入凭证",
    desc: "回到应用的「凭证与基础信息」页面，复制 App ID 和 App Secret 填入下方。",
    url: "https://open.feishu.cn/app",
    urlLabel: "打开飞书开放平台 - 查看凭证",
  },
  {
    key: "test",
    label: "连接测试",
    desc: "验证飞书凭证是否正确，确认 WebSocket 连接正常。",
    url: null,
    urlLabel: null,
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

export default function Feishu() {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [config, setConfig] = useState({ appId: "", appSecret: "", verificationToken: "", encryptKey: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; botName?: string; error?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await window.clawbox?.getFeishuConfig();
        if (data) setConfig(data);
      } catch {
        // ok
      }
    })();
  }, []);

  const markComplete = (step: number) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
    if (step < STEPS.length - 1) setActiveStep(step + 1);
  };

  const handleSave = async () => {
    try {
      await window.clawbox?.saveFeishuConfig(config);
      setSaved(true);
      markComplete(4);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // handle
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await window.clawbox?.saveFeishuConfig(config);
      const result = await window.clawbox?.testFeishuConnection();
      setTestResult(result ?? { success: false, error: "API 不可用" });
      if (result?.success) markComplete(5);
    } catch (err) {
      setTestResult({ success: false, error: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const step = STEPS[activeStep];

  return (
    <div className="flex gap-4 h-full">
      {/* Left — step navigation */}
      <div className="w-48 flex-shrink-0">
        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
          飞书接入步骤
        </div>
        <div className="space-y-1">
          {STEPS.map((s, i) => (
            <motion.button
              key={s.key}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveStep(i)}
              className={`w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-2.5 relative ${
                activeStep === i ? "" : "hover:bg-neutral-50"
              }`}
            >
              {activeStep === i && (
                <motion.div
                  layoutId="feishu-step-active"
                  className="absolute inset-0 bg-neutral-100 rounded-xl"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <div className={`relative z-[1] w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${
                completedSteps.has(i)
                  ? "bg-neutral-800 text-white"
                  : activeStep === i
                    ? "bg-neutral-200 text-neutral-600"
                    : "bg-neutral-100 text-neutral-400"
              }`}>
                {completedSteps.has(i) ? "✓" : i + 1}
              </div>
              <span className={`relative z-[1] text-[11px] font-medium transition-colors duration-200 ${
                activeStep === i ? "text-neutral-700" : "text-neutral-400"
              }`}>
                {s.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Right — step detail */}
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
          {step.label}
        </div>

        <div className="text-[14px] font-medium text-neutral-700 mb-2">{step.label}</div>

        {/* Guide card with link */}
        <div className="bg-[#EFF6FF] rounded-2xl p-4 mb-4">
          <p className="text-[11px] text-neutral-500 leading-5 mb-3">{step.desc}</p>
          {step.url && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => openLink(step.url!)}
              className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#2563EB] bg-white px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors duration-200"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                <path d="M5 3H3.5C2.67 3 2 3.67 2 4.5v4C2 9.33 2.67 10 3.5 10h4c.83 0 1.5-.67 1.5-1.5V7M7 2h3v3M5.5 6.5L10 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {step.urlLabel}
            </motion.button>
          )}
        </div>

        {/* Step-specific content */}
        {activeStep <= 3 && (
          <div className="bg-neutral-100 rounded-2xl p-4">
            <p className="text-[10px] text-neutral-400 mb-3">
              在飞书开放平台完成此步骤后，点击下方按钮继续。
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => markComplete(activeStep)}
              className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
                completedSteps.has(activeStep)
                  ? "bg-neutral-200 text-neutral-400"
                  : "bg-neutral-800 text-white"
              }`}
            >
              {completedSteps.has(activeStep) ? "已完成" : "我已完成这一步"}
            </motion.button>
          </div>
        )}

        {activeStep === 4 && (
          <div className="bg-neutral-100 rounded-2xl p-4 space-y-3">
            <FieldInput
              label="App ID"
              value={config.appId}
              onChange={(v) => setConfig((c) => ({ ...c, appId: v }))}
              placeholder="cli_xxxxxxxxxx"
              required
            />
            <FieldInput
              label="App Secret"
              value={config.appSecret}
              onChange={(v) => setConfig((c) => ({ ...c, appSecret: v }))}
              placeholder="xxxxxxxxxxxxxxxx"
              type="password"
              required
            />
            <FieldInput
              label="Verification Token"
              value={config.verificationToken}
              onChange={(v) => setConfig((c) => ({ ...c, verificationToken: v }))}
              placeholder="可选"
            />
            <FieldInput
              label="Encrypt Key"
              value={config.encryptKey}
              onChange={(v) => setConfig((c) => ({ ...c, encryptKey: v }))}
              placeholder="可选，推荐开启"
              type="password"
            />
            <div className="pt-1 flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={!config.appId || !config.appSecret}
                className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
                  config.appId && config.appSecret
                    ? "bg-neutral-800 text-white"
                    : "bg-neutral-200 text-neutral-400"
                }`}
              >
                保存凭证
              </motion.button>
              {saved && <span className="text-[10px] font-medium text-emerald-600">已保存</span>}
            </div>
          </div>
        )}

        {activeStep === 5 && (
          <div className="bg-neutral-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleTest}
                disabled={testing || !config.appId}
                className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
                  !testing && config.appId
                    ? "bg-neutral-800 text-white"
                    : "bg-neutral-200 text-neutral-400"
                }`}
              >
                {testing ? "验证中..." : "验证连接"}
              </motion.button>
            </div>
            {testResult && (
              <div className={`rounded-xl p-3 ${testResult.success ? "bg-white" : "bg-red-50"}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${testResult.success ? "bg-emerald-500" : "bg-red-400"}`} />
                  <span className={`text-[11px] font-medium ${testResult.success ? "text-neutral-700" : "text-red-500"}`}>
                    {testResult.success
                      ? `连接成功${testResult.botName ? ` — ${testResult.botName}` : ""}`
                      : testResult.error || "连接失败"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldInput({
  label, value, onChange, placeholder, required, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; type?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-3">
      <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
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
