import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Status {
  daemon: { running: boolean; port: number };
  model: { available: boolean; provider: string | null; model: string | null };
  feishu: { connected: boolean };
  security: { safe: boolean; profile: string };
  version: string;
}

export default function Dashboard() {
  const [status, setStatus] = useState<Status>({
    daemon: { running: false, port: 18789 },
    model: { available: false, provider: null, model: null },
    feishu: { connected: false },
    security: { safe: true, profile: "messaging" },
    version: "0.1.0",
  });
  const [loading, setLoading] = useState(true);
  const [recentErrors, setRecentErrors] = useState<string[]>([]);

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

      setStatus({
        daemon: { running: daemon.running, port: daemon.port },
        model: {
          available: !!modelCfg?.apiKey,
          provider: modelCfg?.name ?? null,
          model: modelCfg?.model ?? null,
        },
        feishu: { connected: !!feishuCfg?.appId },
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

  const handleStart = async () => {
    try {
      await window.clawbox?.startDaemon();
      await refresh();
    } catch { /* */ }
  };

  const handleStop = async () => {
    try {
      await window.clawbox?.stopDaemon();
      await refresh();
    } catch { /* */ }
  };

  const handleRestart = async () => {
    try {
      await window.clawbox?.restartDaemon();
      await refresh();
    } catch { /* */ }
  };

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[14px] font-medium text-neutral-700">ClawBox 控制台</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">v{status.version}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.daemon.running ? "bg-emerald-500" : "bg-neutral-300"}`} />
          <span className="text-[10px] font-medium text-neutral-500">
            {status.daemon.running ? "运行中" : "未启动"}
          </span>
          <div className="flex gap-1 ml-2">
            {!status.daemon.running ? (
              <ActionBtn label="启动" onClick={handleStart} />
            ) : (
              <>
                <ActionBtn label="重启" onClick={handleRestart} />
                <ActionBtn label="停止" onClick={handleStop} variant="secondary" />
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
        />
        <StatusCard
          label="飞书"
          value={status.feishu.connected ? "已配置" : "未接入"}
          ok={status.feishu.connected}
          detail={status.feishu.connected ? "WebSocket 长连接" : "前往飞书页面接入"}
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
          <ActionBtn label="刷新状态" onClick={refresh} />
          <ActionBtn label="运行诊断" onClick={async () => {
            const result = await window.clawbox?.runDiagnostics();
            if (result) alert(result.checks.map(c => `${c.passed ? "✓" : "✗"} ${c.name}: ${c.detail}`).join("\n"));
          }} />
          <ActionBtn label="检查更新" onClick={async () => {
            const result = await window.clawbox?.checkUpdate();
            alert(result?.hasUpdate ? `有新版本: ${result.version}` : "已是最新版本");
          }} />
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value, ok, detail }: { label: string; value: string; ok: boolean; detail: string }) {
  return (
    <div className="bg-neutral-100 rounded-2xl p-4">
      <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">{label}</div>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-neutral-300"}`} />
        <span className="text-[11px] font-medium text-neutral-700">{value}</span>
      </div>
      <div className="text-[10px] text-neutral-400">{detail}</div>
    </div>
  );
}

function ActionBtn({ label, onClick, variant = "primary" }: { label: string; onClick: () => void; variant?: "primary" | "secondary" }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`text-[10px] font-medium px-3 py-1.5 rounded-lg ${
        variant === "primary"
          ? "bg-neutral-800 text-white"
          : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
      }`}
    >
      {label}
    </motion.button>
  );
}
