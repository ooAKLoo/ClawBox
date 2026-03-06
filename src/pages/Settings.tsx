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
