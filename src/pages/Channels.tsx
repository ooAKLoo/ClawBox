import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FeishuConfig, FeishuPreflightCheck } from "../types/global";
import Term from "../components/Glossary";
import feishuIconSrc from "../assets/icons/feishu.png";
import discordIconSrc from "../assets/icons/discord.png";

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

export default function Channels() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Feishu
  const [feishuConfig, setFeishuConfig] = useState<FeishuConfig>({
    appId: "",
    appSecret: "",
    verificationToken: "",
    encryptKey: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Activate flow state
  const [activating, setActivating] = useState(false);
  const [activateStage, setActivateStage] = useState<string>("");
  const [activateResult, setActivateResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [preflightChecks, setPreflightChecks] = useState<FeishuPreflightCheck[]>([]);

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

  const appId = feishuConfig.appId.trim();
  const feishuAppUrl = appId
    ? `https://open.feishu.cn/app/${appId}`
    : null;

  const handleActivate = async () => {
    setActivating(true);
    setActivateResult(null);
    setPreflightChecks([]);
    setActivateStage("preflight");
    try {
      const result = await window.clawbox?.activateFeishuChannel(feishuConfig);
      if (!result) {
        setActivateResult({ success: false, error: "API not available" });
        return;
      }
      if (result.checks) setPreflightChecks(result.checks);
      if (result.stage === "preflight") {
        // Preflight failed — show checks, don't set as final error
        setActivateResult({ success: false, error: result.error });
      } else {
        setActivateResult({ success: result.success, error: result.error });
      }
      if (result.success) {
        const daemon = await window.clawbox?.getDaemonStatus();
        if (daemon) setGatewayRunning(daemon.running);
        window.dispatchEvent(new CustomEvent("clawbox-config-changed"));
      }
    } catch (err) {
      setActivateResult({ success: false, error: String(err) });
    } finally {
      setActivating(false);
      setActivateStage("");
    }
  };

  const hasPreflightFailures = preflightChecks.some((c) => !c.passed);

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
          icon={<FeishuIcon />}
          status={activateResult?.success ? "connected" : "idle"}
          statusLabel={activateResult?.success ? "已连接" : feishuConfigured ? "已配置（未验证）" : "未配置"}
          expanded={expandedId === "feishu"}
          onToggle={() =>
            setExpandedId(expandedId === "feishu" ? null : "feishu")
          }
        >
          <div className="space-y-4">
            {/* Step 1 */}
            <StepItem
              number={1}
              title="创建飞书应用"
              hint="前往飞书开放平台，创建一个「企业自建应用」"
            >
              <LinkButton
                label="打开飞书开放平台"
                url="https://open.feishu.cn/app/"
              />
            </StepItem>

            {/* Step 2 */}
            <StepItem
              number={2}
              title="填入应用凭证"
              hint={<>在应用的「凭证与基础信息」页面复制 <Term k="App ID" /> 和 <Term k="App Secret" /></>}
            >
              <div className="space-y-2">
                <ConfigField
                  label={<Term k="App ID" />}
                  required
                  value={feishuConfig.appId}
                  onChange={(v) =>
                    setFeishuConfig({ ...feishuConfig, appId: v })
                  }
                  placeholder="cli_xxxxx"
                />
                <ConfigField
                  label={<Term k="App Secret" />}
                  required
                  value={feishuConfig.appSecret}
                  onChange={(v) =>
                    setFeishuConfig({ ...feishuConfig, appSecret: v })
                  }
                  placeholder="xxxxx"
                  type="password"
                />
              </div>
              {feishuAppUrl && (
                <div className="mt-2">
                  <LinkButton
                    label="打开此应用的凭证页"
                    url={`${feishuAppUrl}/baseinfo`}
                  />
                </div>
              )}
            </StepItem>

            {/* Step 3 — 保存并连接 (with auto preflight) */}
            <StepItem
              number={3}
              title="保存并连接"
              hint={<>自动检测权限和配置，保存后启动 <Term k="Gateway" /> 并验证飞书 <Term k="WebSocket">长连接</Term></>}
            >
              <div className="space-y-3">
                <motion.button
                  whileTap={!feishuIsValid || activating ? undefined : { scale: 0.97 }}
                  onClick={handleActivate}
                  disabled={!feishuIsValid || activating}
                  className={`text-[10px] font-medium px-4 py-2 rounded-lg transition-colors duration-200 ${
                    !feishuIsValid || activating
                      ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      : "bg-neutral-800 text-white"
                  }`}
                >
                  {activating
                    ? activateStage === "preflight"
                      ? "检测配置中..."
                      : "连接中（等待长连接建立）..."
                    : hasPreflightFailures
                      ? "重新检测并连接"
                      : "保存并连接"}
                </motion.button>

                {!feishuIsValid && (
                  <p className="text-[9px] text-neutral-300">请先填入 App ID 和 App Secret</p>
                )}

                {activating && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[9px] text-neutral-400">
                      {activateStage === "preflight"
                        ? "正在验证凭证和检测权限配置..."
                        : "Gateway 已启动，等待飞书 WebSocket 长连接建立..."}
                    </span>
                  </div>
                )}

                {/* Preflight check results */}
                {preflightChecks.length > 0 && !activating && (
                  <div className="bg-white rounded-xl p-3 space-y-2">
                    <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide">
                      配置检测结果
                    </div>
                    {preflightChecks.map((check) => (
                      <div key={check.key} className="flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${check.passed ? "bg-emerald-500" : "bg-red-400"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium ${check.passed ? "text-neutral-600" : "text-red-500"}`}>
                              {check.label}
                            </span>
                            {!check.passed && check.fixUrl && (
                              <button
                                onClick={() => openLink(check.fixUrl!)}
                                className="text-[9px] font-medium text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors duration-200 flex-shrink-0"
                              >
                                去修复
                              </button>
                            )}
                          </div>
                          <p className="text-[9px] text-neutral-400 mt-0.5">{check.detail}</p>
                        </div>
                      </div>
                    ))}
                    {hasPreflightFailures && (
                      <p className="text-[9px] text-neutral-400 border-t border-neutral-100 pt-2">
                        修复以上问题后，需在飞书开放平台「创建版本」并发布，然后点击「重新检测并连接」
                      </p>
                    )}
                  </div>
                )}

                {/* Final result (non-preflight) */}
                {activateResult && !activating && !hasPreflightFailures && (
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activateResult.success ? "bg-emerald-500" : "bg-red-400"}`} />
                    <span className={`text-[10px] font-medium ${activateResult.success ? "text-emerald-600" : "text-red-400"}`}>
                      {activateResult.success
                        ? "飞书长连接已建立，通道已激活"
                        : activateResult.error || "连接失败"}
                    </span>
                  </div>
                )}

                {/* Timeout hint */}
                {activateResult && !activateResult.success && !hasPreflightFailures && !activating && (
                  <div className="bg-white rounded-xl p-3">
                    <p className="text-[9px] text-neutral-400">
                      如果检测全部通过但连接超时，请确认：
                    </p>
                    <ul className="text-[9px] text-neutral-400 mt-1.5 space-y-1 list-disc list-inside">
                      <li>
                        事件订阅方式已选择「长连接」
                        {feishuAppUrl && (
                          <button onClick={() => openLink(`${feishuAppUrl}/event`)} className="text-[#2563EB] ml-1">查看</button>
                        )}
                      </li>
                      <li>
                        已添加事件 <code className="bg-neutral-50 px-1 py-0.5 rounded text-neutral-600">im.message.receive_v1</code>
                      </li>
                      <li>应用已创建版本并发布审批通过</li>
                    </ul>
                  </div>
                )}
              </div>
            </StepItem>

            {/* Advanced settings */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[9px] text-neutral-400 hover:text-neutral-500 transition-colors duration-200"
            >
              {showAdvanced ? "收起高级设置" : "高级设置"}
              <span className="ml-1">{showAdvanced ? "▴" : "▾"}</span>
            </button>
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2">
                    <ConfigField
                      label={<Term k="Verification Token" />}
                      value={feishuConfig.verificationToken}
                      onChange={(v) =>
                        setFeishuConfig({
                          ...feishuConfig,
                          verificationToken: v,
                        })
                      }
                      placeholder="可选，用于验证请求来源"
                    />
                    <ConfigField
                      label={<Term k="Encrypt Key" />}
                      value={feishuConfig.encryptKey}
                      onChange={(v) =>
                        setFeishuConfig({
                          ...feishuConfig,
                          encryptKey: v,
                        })
                      }
                      placeholder="可选，用于加密事件数据"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ChannelCard>

        {/* ---- Discord ---- */}
        <ChannelCard
          name="Discord Bot"
          description="通过 Discord Bot 接收消息，在频道中触发助手"
          icon={<img src={discordIconSrc} alt="Discord" className="w-[18px] h-[18px]" />}
          status="coming_soon"
          statusLabel="即将支持"
          expanded={false}
          onToggle={() => {}}
        />

        {/* ---- Local CLI ---- */}
        <ChannelCard
          name={<>本地 <Term k="CLI" /> / HTTP API</>}
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

function FeishuIcon() {
  return (
    <img src={feishuIconSrc} alt="飞书" className="w-[18px] h-[18px]" />
  );
}

function StepItem({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[9px] font-bold text-neutral-400 flex-shrink-0 mt-0.5">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-neutral-700">
          {title}
        </div>
        <p className="text-[9px] text-neutral-400 mt-0.5 mb-2">{hint}</p>
        {children}
      </div>
    </div>
  );
}

function LinkButton({ label, url }: { label: string; url: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => openLink(url)}
      className="inline-flex items-center gap-1 text-[10px] font-medium text-[#2563EB] bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors duration-200"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="flex-shrink-0"
      >
        <path
          d="M5 3H3.5C2.67 3 2 3.67 2 4.5v4C2 9.33 2.67 10 3.5 10h4c.83 0 1.5-.67 1.5-1.5V7M7 2h3v3M5.5 6.5L10 2"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </motion.button>
  );
}

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
  name: React.ReactNode;
  description: string;
  icon: React.ReactNode;
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
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[11px] font-bold text-neutral-500 flex-shrink-0 overflow-hidden">
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
  label: React.ReactNode;
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
