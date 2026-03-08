import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { AppSettings } from "../types/global";
import clawboxIcon from "../assets/icons/clawbox.png";
import bilibiliIcon from "../assets/icons/bilibili.png";
import xiaohongshuIcon from "../assets/icons/xiaohongshu.png";

const defaultSettings: AppSettings = {
  autoStart: false,
  autoUpdate: true,
  language: "zh-CN",
  dataDir: "",
};

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [version, setVersion] = useState("0.1.0");
  const [loaded, setLoaded] = useState(false);

  // Feedback
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Update
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ hasUpdate: boolean; latestVersion?: string; releaseNotes?: string; downloadUrl?: string } | null>(null);

  // Logs
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  useEffect(() => {
    if (!open) { setLoaded(false); return; }
    (async () => {
      try {
        const [s, v] = await Promise.all([
          window.clawbox?.getSettings(),
          window.clawbox?.getVersion(),
        ]);
        if (s) setSettings(s);
        if (v) setVersion(v);
      } catch { /* */ }
      setLoaded(true);
    })();
  }, [open]);

  // Auto-save with debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.clawbox?.saveSettings(settings);
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [settings, loaded]);

  const handleCheckUpdate = async () => {
    setUpdateChecking(true);
    setUpdateResult(null);
    try {
      const result = await window.clawbox?.checkUpdate();
      if (result) setUpdateResult(result);
    } catch { /* */ }
    setUpdateChecking(false);
  };

  const handleExportLogs = async () => {
    setExporting(true);
    try {
      const result = await window.clawbox?.exportLogs();
      if (result?.success) {
        setExportDone(true);
        setTimeout(() => setExportDone(false), 3000);
      }
    } catch { /* */ }
    setExporting(false);
  };

  const handleSendFeedback = async () => {
    if (!feedbackContent.trim()) return;
    setFeedbackSending(true);
    setFeedbackResult(null);
    try {
      const result = await window.clawbox?.sendFeedback({
        content: feedbackContent.trim(),
        contact: feedbackContact.trim() || undefined,
      });
      if (result?.success) {
        setFeedbackResult({ ok: true, msg: "反馈已提交，感谢！" });
        setFeedbackContent("");
        setFeedbackContact("");
      } else {
        setFeedbackResult({ ok: false, msg: result?.error || "提交失败" });
      }
    } catch {
      setFeedbackResult({ ok: false, msg: "提交失败" });
    }
    setFeedbackSending(false);
  };

  const handleResetOnboarding = async () => {
    try {
      await window.clawbox?.setOnboardingComplete(false);
    } catch { /* */ }
    localStorage.removeItem("clawbox-onboarding-complete");
    window.dispatchEvent(new CustomEvent("clawbox-reset-onboarding"));
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative bg-white rounded-3xl w-[480px] max-h-[80vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <img src={clawboxIcon} alt="" className="w-9 h-9 rounded-xl flex-shrink-0" />
                <div>
                  <div className="text-[14px] font-medium text-neutral-700">ClawBox</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">v{version}</div>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-400 transition-colors duration-200"
              >
                <X size={14} />
              </motion.button>
            </div>

            {/* Content */}
            <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-3">
              {/* General */}
              <div className="bg-neutral-100 rounded-2xl p-4 space-y-2">
                <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                  常规
                </div>
                <ToggleRow
                  title="开机自启动"
                  desc="登录系统时自动启动 ClawBox"
                  value={settings.autoStart}
                  onChange={(v) => setSettings((s) => ({ ...s, autoStart: v }))}
                />
                <ToggleRow
                  title="自动更新"
                  desc="有新版本时自动下载安装"
                  value={settings.autoUpdate}
                  onChange={(v) => setSettings((s) => ({ ...s, autoUpdate: v }))}
                />
              </div>


              {/* Logs + Diagnostics */}
              <div className="bg-neutral-100 rounded-2xl p-4">
                <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  日志
                </div>
                <div className="bg-white rounded-xl p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="text-[11px] font-medium text-neutral-700">导出运行日志</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      {exportDone ? "日志已保存到桌面" : "导出所有运行日志到本地文件"}
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleExportLogs}
                    disabled={exporting}
                    className={`text-[10px] font-medium px-3 py-1.5 rounded-lg flex-shrink-0 ${
                      exporting
                        ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                        : exportDone
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
                    }`}
                  >
                    {exporting ? "导出中..." : exportDone ? "已导出" : "导出"}
                  </motion.button>
                </div>
              </div>

              {/* Update */}
              <div className="bg-neutral-100 rounded-2xl p-4">
                <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  版本更新
                </div>
                <div className="bg-white rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="text-[11px] font-medium text-neutral-700">检查更新</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        {updateResult
                          ? updateResult.hasUpdate
                            ? `发现新版本 v${updateResult.latestVersion}`
                            : "已是最新版本"
                          : `当前版本 v${version}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {updateResult?.hasUpdate && updateResult.downloadUrl && (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => window.clawbox?.openExternal(updateResult.downloadUrl!)}
                          className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-800 text-white"
                        >
                          下载
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleCheckUpdate}
                        disabled={updateChecking}
                        className={`text-[10px] font-medium px-3 py-1.5 rounded-lg ${
                          updateChecking
                            ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                            : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
                        }`}
                      >
                        {updateChecking ? "检查中..." : "检查"}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-neutral-100 rounded-2xl p-4">
                <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  操作
                </div>
                <div className="bg-white rounded-xl p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="text-[11px] font-medium text-neutral-700">重新运行初始引导</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">重置 Onboarding 并重新走一遍设置流程</div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleResetOnboarding}
                    className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
                  >
                    重置
                  </motion.button>
                </div>
              </div>

              {/* Feedback */}
              <div className="bg-neutral-100 rounded-2xl p-4 space-y-2">
                <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide">
                  用户反馈
                </div>
                <textarea
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  placeholder="遇到问题或有建议？在这里告诉我们..."
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-[11px] text-neutral-700 placeholder:text-neutral-300 resize-none h-20 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={feedbackContact}
                    onChange={(e) => setFeedbackContact(e.target.value)}
                    placeholder="联系方式（选填）"
                    className="flex-1 bg-white rounded-xl px-3 py-2 text-[10px] text-neutral-700 placeholder:text-neutral-300 focus:outline-none"
                  />
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSendFeedback}
                    disabled={feedbackSending || !feedbackContent.trim()}
                    className={`text-[10px] font-medium px-3 py-1.5 rounded-lg flex-shrink-0 ${
                      feedbackSending || !feedbackContent.trim()
                        ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                        : "bg-neutral-800 text-white"
                    }`}
                  >
                    {feedbackSending ? "提交中..." : "提交反馈"}
                  </motion.button>
                </div>
                {feedbackResult && (
                  <div className={`text-[10px] font-medium ${feedbackResult.ok ? "text-emerald-600" : "text-red-500"}`}>
                    {feedbackResult.msg}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 pb-1 flex items-center justify-center gap-2.5">
                <span className="text-[10px] text-neutral-300 tracking-wide">唔叽唔哩 ｜ 捕捉"附近"</span>
                <span className="w-px h-3 bg-neutral-200" />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.clawbox?.openExternal("https://space.bilibili.com/22541325")}
                    className="opacity-30 hover:opacity-100 transition-opacity duration-200"
                  >
                    <img src={bilibiliIcon} alt="哔哩哔哩" className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => window.clawbox?.openExternal("https://www.xiaohongshu.com/user/profile/5e4125ff00000000010064fd")}
                    className="opacity-30 hover:opacity-100 transition-opacity duration-200"
                  >
                    <img src={xiaohongshuIcon} alt="小红书" className="w-3.5 h-3.5 rounded" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToggleRow({ title, desc, value, onChange }: {
  title: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-white rounded-xl p-3 flex items-center justify-between">
      <div className="flex-1 min-w-0 mr-3">
        <div className="text-[11px] font-medium text-neutral-700">{title}</div>
        <div className="text-[10px] text-neutral-400 mt-0.5">{desc}</div>
      </div>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full relative flex-shrink-0 transition-colors duration-200 ${
          value ? "bg-neutral-800" : "bg-neutral-200"
        }`}
      >
        <motion.div
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full"
          animate={{ left: value ? 18 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      </motion.button>
    </div>
  );
}
