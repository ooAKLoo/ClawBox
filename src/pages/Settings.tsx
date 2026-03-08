import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { AppSettings } from "../types/global";

const defaultSettings: AppSettings = {
  autoStart: false,
  autoUpdate: true,
  language: "zh-CN",
  dataDir: "",
};

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [version, setVersion] = useState("0.1.0");
  const [saved, setSaved] = useState(false);

  // Feedback
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Update
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ hasUpdate: boolean; latestVersion?: string; releaseNotes?: string; downloadUrl?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, v] = await Promise.all([
          window.clawbox?.getSettings(),
          window.clawbox?.getVersion(),
        ]);
        if (s) setSettings(s);
        if (v) setVersion(v);
      } catch { /* */ }
    })();
  }, []);

  const handleSave = async () => {
    try {
      await window.clawbox?.saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* */ }
  };

  const handleCheckUpdate = async () => {
    setUpdateChecking(true);
    setUpdateResult(null);
    try {
      const result = await window.clawbox?.checkUpdate();
      if (result) setUpdateResult(result);
    } catch { /* */ }
    setUpdateChecking(false);
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
  };

  return (
    <div>
      <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-4">
        设置
      </div>
      <div className="text-[14px] font-medium text-neutral-700 mb-6">应用设置</div>

      <div className="space-y-4">
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

        {/* Language */}
        <div className="bg-neutral-100 rounded-2xl p-4">
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
            语言
          </div>
          <div className="bg-white rounded-xl p-3">
            <div className="flex gap-1.5">
              {[
                { value: "zh-CN", label: "简体中文" },
                { value: "en", label: "English" },
              ].map((lang) => (
                <motion.button
                  key={lang.value}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSettings((s) => ({ ...s, language: lang.value }))}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${
                    settings.language === lang.value
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  }`}
                >
                  {lang.label}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Data directory */}
        <div className="bg-neutral-100 rounded-2xl p-4">
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
            数据目录
          </div>
          <div className="bg-white rounded-xl p-3">
            <div className="text-[10px] text-neutral-400 font-mono bg-neutral-50 rounded-lg px-3 py-2 break-all">
              {settings.dataDir || "~/.clawbox"}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-neutral-100 rounded-2xl p-4 space-y-2">
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
            操作
          </div>
          <div className="bg-white rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-neutral-700">重新运行初始引导</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">重置 Onboarding 状态并重新走一遍设置流程</div>
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

        {/* Update check */}
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
            {updateResult?.hasUpdate && updateResult.releaseNotes && (
              <div className="mt-2 text-[10px] text-neutral-400 bg-neutral-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                {updateResult.releaseNotes}
              </div>
            )}
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

        {/* About */}
        <div className="bg-neutral-100 rounded-2xl p-4">
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
            关于
          </div>
          <div className="bg-white rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-400">版本</span>
              <span className="text-[10px] font-medium text-neutral-700">v{version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-400">产品</span>
              <span className="text-[10px] font-medium text-neutral-700">ClawBox — OpenClaw 飞书安全桌面版</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-400">运行时</span>
              <span className="text-[10px] font-medium text-neutral-700">Electron</span>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            className="text-[10px] font-medium px-4 py-2 rounded-lg bg-neutral-800 text-white"
          >
            保存设置
          </motion.button>
          {saved && <span className="text-[10px] font-medium text-emerald-600">已保存</span>}
        </div>
      </div>
    </div>
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
