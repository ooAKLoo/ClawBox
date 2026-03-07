import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { LogEntry } from "../types/global";
import Dialog from "../components/Dialog";

type FilterKey = "all" | "error" | "assistant" | "model" | "system";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "error", label: "错误" },
  { key: "assistant", label: "助手" },
  { key: "model", label: "模型" },
  { key: "system", label: "系统" },
];


export default function Logs() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState<{ name: string; passed: boolean; detail: string }[] | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPath, setExportPath] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Load history + subscribe to real-time logs
  useEffect(() => {
    (async () => {
      try {
        const data = await window.clawbox?.getLogs();
        if (data && data.length > 0) setLogs(data);
      } catch { /* ok */ }
    })();
    const cleanup = window.clawbox?.onDaemonLog((entry) => {
      setLogs((prev) => {
        const next = [...prev, entry];
        return next.length > 2000 ? next.slice(-2000) : next;
      });
    });
    return () => { cleanup?.(); };
  }, []);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll]);

  const filtered = logs.filter((l) => {
    if (filter === "all") return true;
    if (filter === "error") return l.level === "error";
    if (filter === "assistant") return l.category === "assistant";
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
      if (result?.success) {
        setExportPath(result.path);
        setExportOpen(true);
      }
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
              <span className={`relative z-[1] transition-colors duration-200 ${filter === f.key ? "text-neutral-800" : "text-neutral-400"
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
        <div
          className="bg-neutral-50 rounded-lg p-3 min-h-[320px] max-h-[480px] overflow-y-auto font-mono"
          onScroll={(e) => {
            const el = e.currentTarget;
            setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
          }}
        >
          {filtered.length === 0 ? (
            <div className="text-[10px] text-neutral-300 text-center py-8">暂无日志</div>
          ) : (
            filtered.map((log, i) => (
              <div key={i} className="flex gap-3 text-[10px] leading-5 hover:bg-neutral-100 rounded px-1">
                <span className="text-neutral-300 flex-shrink-0 w-14">{log.time}</span>
                <span className={`flex-shrink-0 uppercase w-10 ${log.level === "error" ? "text-red-400"
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
          <div ref={logEndRef} />
        </div>
      </div>

      {/* 导出成功 Dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} title="导出完成">
        <div className="text-[11px] text-neutral-600">
          日志已导出到：
          <span className="block mt-1 font-mono text-[10px] text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2 break-all">
            {exportPath}
          </span>
        </div>
      </Dialog>
    </div>
  );
}
