import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FeishuConfig } from "../types/global";

export default function Channels() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Feishu
  const [feishuConfig, setFeishuConfig] = useState<FeishuConfig>({
    appId: "",
    appSecret: "",
    verificationToken: "",
    encryptKey: "",
  });
  const [feishuTesting, setFeishuTesting] = useState(false);
  const [feishuTestResult, setFeishuTestResult] = useState<{
    success: boolean;
    botName?: string;
    error?: string;
  } | null>(null);
  const [feishuSaved, setFeishuSaved] = useState(false);

  // Gateway
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [gatewayPort, setGatewayPort] = useState(18789);

  useEffect(() => {
    (async () => {
      const api = window.clawbox;
      if (!api) return;
      const [feishu, daemon] = await Promise.all([
        api.getFeishuConfig(),
        api.getDaemonStatus(),
      ]);
      if (feishu) setFeishuConfig(feishu);
      setGatewayRunning(daemon.running);
      setGatewayPort(daemon.port);
    })();
  }, []);

  const feishuConfigured = !!(feishuConfig.appId && feishuConfig.appSecret);
  const feishuIsValid =
    feishuConfig.appId.trim() && feishuConfig.appSecret.trim();

  const handleFeishuTest = async () => {
    setFeishuTesting(true);
    setFeishuTestResult(null);
    try {
      // Save first so the backend has credentials to test
      await window.clawbox?.saveFeishuConfig(feishuConfig);
      const result = await window.clawbox?.testFeishuConnection();
      setFeishuTestResult(
        result ?? { success: false, error: "API 不可用" }
      );
    } catch (err) {
      setFeishuTestResult({ success: false, error: String(err) });
    } finally {
      setFeishuTesting(false);
    }
  };

  const handleFeishuSave = async () => {
    try {
      await window.clawbox?.saveFeishuConfig(feishuConfig);
      setFeishuSaved(true);
      setTimeout(() => setFeishuSaved(false), 2000);
      window.dispatchEvent(new CustomEvent("clawbox-config-changed"));
    } catch {
      // handle
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="text-[14px] font-medium text-neutral-700">通道</div>
        <div className="text-[10px] text-neutral-400 mt-0.5">
          管理消息入口，连接远程通讯平台以触发助手
        </div>
      </div>

      <div className="space-y-3">
        {/* ---- Feishu ---- */}
        <ChannelCard
          name="飞书机器人"
          description="在飞书中 @机器人 发送消息，即可触发助手处理"
          icon="飞"
          status={feishuConfigured ? "connected" : "idle"}
          statusLabel={feishuConfigured ? "已配置" : "未配置"}
          expanded={expandedId === "feishu"}
          onToggle={() =>
            setExpandedId(expandedId === "feishu" ? null : "feishu")
          }
        >
          <div className="space-y-3">
            {/* Webhook URL hint */}
            {gatewayRunning && (
              <div className="bg-white rounded-xl p-3">
                <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
                  事件订阅回调 URL（填入飞书开发者后台）
                </label>
                <div className="text-[10px] text-neutral-500 font-mono bg-neutral-50 rounded-lg px-3 py-2 select-all">
                  http://127.0.0.1:{gatewayPort}/feishu/webhook
                </div>
              </div>
            )}

            <ConfigField
              label="App ID"
              required
              value={feishuConfig.appId}
              onChange={(v) =>
                setFeishuConfig({ ...feishuConfig, appId: v })
              }
              placeholder="cli_xxxxx"
            />
            <ConfigField
              label="App Secret"
              required
              value={feishuConfig.appSecret}
              onChange={(v) =>
                setFeishuConfig({ ...feishuConfig, appSecret: v })
              }
              placeholder="xxxxx"
              type="password"
            />
            <ConfigField
              label="Verification Token"
              value={feishuConfig.verificationToken}
              onChange={(v) =>
                setFeishuConfig({
                  ...feishuConfig,
                  verificationToken: v,
                })
              }
              placeholder="可选"
            />
            <ConfigField
              label="Encrypt Key"
              value={feishuConfig.encryptKey}
              onChange={(v) =>
                setFeishuConfig({ ...feishuConfig, encryptKey: v })
              }
              placeholder="可选"
            />

            <div className="flex items-center gap-3 pt-1">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleFeishuTest}
                disabled={!feishuIsValid || feishuTesting}
                className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
                  feishuIsValid && !feishuTesting
                    ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    : "bg-neutral-100 text-neutral-300"
                }`}
              >
                {feishuTesting ? "测试中..." : "连通性测试"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleFeishuSave}
                disabled={!feishuIsValid}
                className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
                  feishuIsValid
                    ? "bg-neutral-800 text-white"
                    : "bg-neutral-200 text-neutral-400"
                }`}
              >
                保存配置
              </motion.button>
              {feishuTestResult && (
                <span
                  className={`text-[10px] font-medium ${
                    feishuTestResult.success
                      ? "text-emerald-600"
                      : "text-red-400"
                  }`}
                >
                  {feishuTestResult.success
                    ? `已连接${
                        feishuTestResult.botName
                          ? ` (${feishuTestResult.botName})`
                          : ""
                      }`
                    : feishuTestResult.error || "连接失败"}
                </span>
              )}
              {feishuSaved && (
                <span className="text-[10px] font-medium text-emerald-600">
                  已保存
                </span>
              )}
            </div>
          </div>
        </ChannelCard>

        {/* ---- Discord ---- */}
        <ChannelCard
          name="Discord Bot"
          description="通过 Discord Bot 接收消息，在频道中触发助手"
          icon="DC"
          status="coming_soon"
          statusLabel="即将支持"
          expanded={false}
          onToggle={() => {}}
        />

        {/* ---- Local CLI ---- */}
        <ChannelCard
          name="本地 CLI / HTTP API"
          description="通过命令行或 HTTP 请求直接调用 Gateway"
          icon=">"
          status={gatewayRunning ? "connected" : "idle"}
          statusLabel={gatewayRunning ? "可用" : "Gateway 未启动"}
          expanded={expandedId === "cli"}
          onToggle={() =>
            setExpandedId(expandedId === "cli" ? null : "cli")
          }
        >
          <div className="space-y-3">
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
        </ChannelCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ChannelCard({
  name,
  description,
  icon,
  status,
  statusLabel,
  expanded,
  onToggle,
  children,
}: {
  name: string;
  description: string;
  icon: string;
  status: "connected" | "idle" | "coming_soon";
  statusLabel: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const isClickable = status !== "coming_soon";
  return (
    <div>
      <motion.button
        whileTap={isClickable ? { scale: 0.99 } : undefined}
        onClick={isClickable ? onToggle : undefined}
        className={`w-full text-left bg-neutral-100 rounded-2xl p-4 transition-colors duration-200 ${
          isClickable
            ? "cursor-pointer hover:bg-neutral-200/60"
            : "cursor-default opacity-60"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[11px] font-bold text-neutral-500 flex-shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-neutral-700">
                {name}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                {description}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {status === "connected" && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-medium text-emerald-600">
                  {statusLabel}
                </span>
              </>
            )}
            {status === "idle" && (
              <span className="text-[9px] font-medium text-neutral-400">
                {statusLabel}
              </span>
            )}
            {status === "coming_soon" && (
              <span className="text-[8px] font-medium text-neutral-400 bg-neutral-200 px-1.5 py-0.5 rounded">
                {statusLabel}
              </span>
            )}
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {expanded && children && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="bg-neutral-100 rounded-2xl p-4 mt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfigField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl p-3">
      <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
        {label} {required && <span className="text-red-400">*</span>}
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
