import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Dialog from "../components/Dialog";

interface Status {
  daemon: { running: boolean; port: number };
  model: { available: boolean; provider: string | null; model: string | null };
  channels: { feishu: boolean; count: number };
  assistants: { active: number; total: number };
  security: { safe: boolean; profile: string };
  version: string;
}

const navigateTo = (page: string) => {
  window.dispatchEvent(new CustomEvent("clawbox-navigate", { detail: page }));
};

export default function Dashboard() {
  const [status, setStatus] = useState<Status>({
    daemon: { running: false, port: 18789 },
    model: { available: false, provider: null, model: null },
    channels: { feishu: false, count: 0 },
    assistants: { active: 0, total: 0 },
    security: { safe: true, profile: "messaging" },
    version: "0.1.0",
  });
  const [loading, setLoading] = useState(true);
  const [daemonLoading, setDaemonLoading] = useState(false);
  const [recentErrors, setRecentErrors] = useState<string[]>([]);

  // Dialog states
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagResult, setDiagResult] = useState<{ name: string; passed: boolean; detail: string }[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const api = window.clawbox;
      if (!api) { setLoading(false); return; }

      const [daemon, modelCfg, feishuCfg, securityCfg, version, logs] = await Promise.all([
        api.getDaemonStatus(),
        api.getModelConfig(),
        api.getFeishuConfig(),
        api.getSecurityConfig(),
        api.getVersion(),
        api.getLogs(),
      ]);

      const feishuOk = !!(feishuCfg?.appId && feishuCfg?.appSecret);
      // CLI is always available when gateway is running
      const channelCount = (feishuOk ? 1 : 0) + (daemon.running ? 1 : 0);

      setStatus({
        daemon: { running: daemon.running, port: daemon.port },
        model: {
          available: !!modelCfg?.apiKey,
          provider: modelCfg?.name ?? null,
          model: modelCfg?.model ?? null,
        },
        channels: { feishu: feishuOk, count: channelCount },
        assistants: { active: 0, total: 0 },
        security: {
          safe: securityCfg.toolsProfile === "messaging" && securityCfg.blockPublicExpose && securityCfg.blockShellAccess,
          profile: securityCfg.toolsProfile,
        },
        version,
      });

      const errors = (logs || [])
        .filter((l: { level: string }) => l.level === "error")
        .slice(-3)
        .map((l: { msg: string }) => l.msg);
      setRecentErrors(errors);
    } catch {
      // ok
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Auto-refresh when model config changes (e.g. saved from Model page)
  useEffect(() => {
    const handler = () => { refresh(); };
    window.addEventListener("clawbox-config-changed", handler);
    return () => window.removeEventListener("clawbox-config-changed", handler);
  }, []);

  const handleStart = async () => {
    setDaemonLoading(true);
    try {
      const result = await window.clawbox?.startDaemon();
      if (result && !result.success) {
        console.error("Daemon start failed:", result.message);
      }
      await refresh();
    } catch (err) {
      console.error("Daemon start error:", err);
    } finally {
      setDaemonLoading(false);
    }
  };

  const handleStop = async () => {
    setDaemonLoading(true);
    try {
      await window.clawbox?.stopDaemon();
      await refresh();
    } catch (err) {
      console.error("Daemon stop error:", err);
    } finally {
      setDaemonLoading(false);
    }
  };

  const handleRestart = async () => {
    setDaemonLoading(true);
    try {
      const result = await window.clawbox?.restartDaemon();
      if (result && !result.success) {
        console.error("Daemon restart failed:", result.message);
      }
      await refresh();
    } catch (err) {
      console.error("Daemon restart error:", err);
    } finally {
      setDaemonLoading(false);
    }
  };

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[14px] font-medium text-neutral-700">控制台</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">v{status.version}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${daemonLoading ? "bg-amber-400 animate-pulse" : status.daemon.running ? "bg-emerald-500" : "bg-neutral-300"}`} />
          <span className="text-[10px] font-medium text-neutral-500">
            {daemonLoading ? "操作中..." : status.daemon.running ? "运行中" : "未启动"}
          </span>
          <div className="flex gap-1 ml-2">
            {!status.daemon.running ? (
              <ActionBtn label={daemonLoading ? "启动中..." : "启动"} onClick={handleStart} disabled={daemonLoading} />
            ) : (
              <>
                <ActionBtn label={daemonLoading ? "重启中..." : "重启"} onClick={handleRestart} disabled={daemonLoading} />
                <ActionBtn label="停止" onClick={handleStop} variant="secondary" disabled={daemonLoading} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status cards — 2 columns */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatusCard
          label="Gateway"
          value={status.daemon.running ? `127.0.0.1:${status.daemon.port}` : "未启动"}
          ok={status.daemon.running}
          detail={status.daemon.running ? "本机监听，安全运行" : "点击右上角启动"}
        />
        <StatusCard
          label="模型"
          value={status.model.available ? `${status.model.provider}` : "未配置"}
          ok={status.model.available}
          detail={status.model.model || "前往模型页面配置"}
          onClick={() => navigateTo("model")}
        />
        <StatusCard
          label="通道"
          value={status.channels.count > 0 ? `${status.channels.count} 个可用` : "未配置"}
          ok={status.channels.count > 0}
          detail={status.channels.feishu ? "飞书已连接" : "前往通道页面配置"}
          onClick={() => navigateTo("channels")}
        />
        <StatusCard
          label="助手"
          value={status.assistants.total > 0 ? `${status.assistants.active} 个运行中` : "未创建"}
          ok={status.assistants.active > 0}
          detail={status.assistants.total > 0 ? `共 ${status.assistants.total} 个助手` : "前往助手页面创建"}
          onClick={() => navigateTo("assistants")}
        />
        <StatusCard
          label="安全状态"
          value={status.security.safe ? "安全模式" : "存在风险项"}
          ok={status.security.safe}
          detail={`权限档位：${status.security.profile}`}
        />
      </div>

      {/* Recent errors */}
      <div className="bg-neutral-100 rounded-2xl p-4 mb-4">
        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
          最近错误
        </div>
        {recentErrors.length === 0 ? (
          <div className="bg-white rounded-xl px-3 py-2">
            <span className="text-[10px] text-neutral-300">暂无错误</span>
          </div>
        ) : (
          <div className="space-y-1">
            {recentErrors.map((e, i) => (
              <div key={i} className="bg-white rounded-xl px-3 py-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-[10px] text-neutral-500 truncate">{e}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-neutral-100 rounded-2xl p-4">
        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
          快捷操作
        </div>
        <div className="flex gap-2 flex-wrap">
          <ActionBtn
            label="浏览器控制台"
            disabled={!status.daemon.running}
            onClick={async () => {
              const result = await window.clawbox?.openBrowserControl();
              if (result && !result.success) {
                console.error("Open browser control failed:", result.message);
              }
            }}
          />
          <ActionBtn label="刷新状态" onClick={refresh} />
          <ActionBtn label="运行诊断" onClick={async () => {
            const result = await window.clawbox?.runDiagnostics();
            if (result) {
              setDiagResult(result.checks);
              setDiagOpen(true);
            }
          }} />
        </div>
      </div>

      {/* 诊断结果 Dialog */}
      <Dialog open={diagOpen} onClose={() => setDiagOpen(false)} title="诊断结果">
        {diagResult.length === 0 ? (
          <div className="text-neutral-400">暂无数据</div>
        ) : (
          <div className="space-y-1.5">
            {diagResult.map((c, i) => (
              <div key={i} className="flex items-center gap-2 bg-neutral-50 rounded-xl px-3 py-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.passed ? "bg-emerald-500" : "bg-red-400"}`} />
                <span className="text-[10px] font-medium text-neutral-700 w-20 flex-shrink-0">{c.name}</span>
                <span className="text-[10px] text-neutral-400 truncate">{c.detail}</span>
              </div>
            ))}
          </div>
        )}
      </Dialog>

    </div>
  );
}

function StatusCard({ label, value, ok, detail, onClick }: { label: string; value: string; ok: boolean; detail: string; onClick?: () => void }) {
  const Wrapper = onClick ? motion.button : "div";
  return (
    <Wrapper
      {...(onClick ? { onClick, whileTap: { scale: 0.98 } } : {})}
      className={`bg-neutral-100 rounded-2xl p-4 text-left ${onClick ? "cursor-pointer hover:bg-neutral-200/60 transition-colors duration-200" : ""}`}
    >
      <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">{label}</div>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-neutral-300"}`} />
        <span className="text-[11px] font-medium text-neutral-700">{value}</span>
      </div>
      <div className="text-[10px] text-neutral-400">
        {detail}
        {onClick && !ok && <span className="ml-1 text-[#2563EB]">&rarr;</span>}
      </div>
    </Wrapper>
  );
}

function ActionBtn({ label, onClick, variant = "primary", disabled = false }: { label: string; onClick: () => void; variant?: "primary" | "secondary"; disabled?: boolean }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`text-[10px] font-medium px-3 py-1.5 rounded-lg transition-colors duration-200 ${
        disabled
          ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
          : variant === "primary"
            ? "bg-neutral-800 text-white"
            : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
      }`}
    >
      {label}
    </motion.button>
  );
}
