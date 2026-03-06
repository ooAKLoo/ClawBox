import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { LogEntry } from "../types/global";

type FilterKey = "all" | "error" | "feishu" | "model" | "system";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "error", label: "错误" },
  { key: "feishu", label: "飞书" },
  { key: "model", label: "模型" },
  { key: "system", label: "系统" },
];

const mockLogs: LogEntry[] = [
  { time: "14:32:01", level: "info", category: "system", msg: "Daemon started on 127.0.0.1:18789" },
  { time: "14:32:02", level: "info", category: "feishu", msg: "Feishu WebSocket connected" },
  { time: "14:32:03", level: "info", category: "system", msg: "tools.profile = messaging" },
  { time: "14:32:05", level: "info", category: "gateway", msg: "Gateway ready, local only" },
  { time: "14:33:12", level: "info", category: "feishu", msg: "Received DM from user@feishu" },
  { time: "14:33:13", level: "info", category: "model", msg: "Request sent to deepseek-chat" },
  { time: "14:33:15", level: "info", category: "model", msg: "Response received (1.8s, 256 tokens)" },
  { time: "14:33:15", level: "info", category: "feishu", msg: "Reply sent to user@feishu" },
  { time: "14:35:01", level: "warn", category: "model", msg: "Rate limit warning: 80% quota used" },
  { time: "14:40:22", level: "error", category: "feishu", msg: "WebSocket reconnecting..." },
  { time: "14:40:25", level: "info", category: "feishu", msg: "WebSocket reconnected" },
];

export default function Logs() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [logs, setLogs] = useState<LogEntry[]>(mockLogs);
  const [diagnostics, setDiagnostics] = useState<{ name: string; passed: boolean; detail: string }[] | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await window.clawbox?.getLogs();
        if (data && data.length > 0) setLogs(data);
      } catch { /* use mock */ }
    })();
  }, []);

  const filtered = logs.filter((l) => {
    if (filter === "all") return true;
    if (filter === "error") return l.level === "error";
    if (filter === "feishu") return l.category === "feishu";
    if (filter === "model") return l.category === "model";
    if (filter === "system") return l.category === "system" || l.category === "gateway";
    return true;
  });

  const handleClear = async () => {
    try {
      await window.clawbox?.clearLogs();
      setLogs([]);
    } catch { /* */ }
  };

  const handleExport = async () => {
    try {
      const result = await window.clawbox?.exportLogs();
      if (result?.success) alert(`日志已导出到: ${result.path}`);
    } catch { /* */ }
  };

  const handleDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const result = await window.clawbox?.runDiagnostics();
      setDiagnostics(result?.checks ?? null);
    } catch { /* */ }
    setDiagLoading(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
            日志与诊断
          </div>
          <div className="text-[14px] font-medium text-neutral-700">运行日志</div>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleExport}
            className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
          >
            导出日志
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleDiagnostics}
            disabled={diagLoading}
            className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-800 text-white"
          >
            {diagLoading ? "检测中..." : "运行诊断"}
          </motion.button>
        </div>
      </div>

      {/* Diagnostics result */}
      {diagnostics && (
        <div className="bg-neutral-100 rounded-2xl p-4 mb-4">
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
            诊断结果
          </div>
          <div className="space-y-1">
            {diagnostics.map((c, i) => (
              <div key={i} className="bg-white rounded-xl px-3 py-2 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.passed ? "bg-emerald-500" : "bg-red-400"}`} />
                <span className="text-[10px] font-medium text-neutral-700 w-24 flex-shrink-0">{c.name}</span>
                <span className="text-[10px] text-neutral-400 truncate">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-0.5 bg-neutral-200 rounded-lg p-0.5 relative">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="relative px-2.5 py-1 text-[10px] font-medium rounded-md z-[1]"
            >
              {filter === f.key && (
                <motion.div
                  layoutId="log-filter-tab"
                  className="absolute inset-0 bg-white rounded-md"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`relative z-[1] transition-colors duration-200 ${
                filter === f.key ? "text-neutral-800" : "text-neutral-400"
              }`}>
                {f.label}
              </span>
            </button>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleClear}
          className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-500"
        >
          清空
        </motion.button>
      </div>

      {/* Log output */}
      <div className="bg-neutral-100 rounded-2xl p-4">
        <div className="bg-neutral-50 rounded-lg p-3 min-h-[320px] max-h-[480px] overflow-y-auto font-mono">
          {filtered.length === 0 ? (
            <div className="text-[10px] text-neutral-300 text-center py-8">暂无日志</div>
          ) : (
            filtered.map((log, i) => (
              <div key={i} className="flex gap-3 text-[10px] leading-5 hover:bg-neutral-100 rounded px-1">
                <span className="text-neutral-300 flex-shrink-0 w-14">{log.time}</span>
                <span className={`flex-shrink-0 uppercase w-10 ${
                  log.level === "error" ? "text-red-400"
                    : log.level === "warn" ? "text-amber-400"
                      : "text-neutral-400"
                }`}>
                  {log.level}
                </span>
                <span className="text-neutral-300 flex-shrink-0 w-14">{log.category}</span>
                <span className="text-neutral-500">{log.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
