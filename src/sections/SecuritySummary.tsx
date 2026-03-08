import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { SecurityConfig } from "../types/global";

const defaults: SecurityConfig = {
  blockPublicExpose: true,
  blockShellAccess: true,
  blockFullDiskAccess: true,
  encryptCredentials: true,
  groupChatEnabled: false,
  groupChatWhitelist: [],
  promptScanEnabled: true,
};

type BooleanKey = {
  [K in keyof SecurityConfig]: SecurityConfig[K] extends boolean ? K : never;
}[keyof SecurityConfig];

type PolicyItem = {
  key: BooleanKey;
  title: string;
  desc: string;
  risk: "critical" | "high" | "medium";
};

const allItems: PolicyItem[] = [
  { key: "blockPublicExpose", title: "禁止公网暴露", desc: "Gateway 仅监听 127.0.0.1", risk: "critical" },
  { key: "blockShellAccess", title: "禁止 Shell 执行", desc: "不允许助手执行系统命令", risk: "critical" },
  { key: "blockFullDiskAccess", title: "禁止全盘文件访问", desc: "限制文件读写到工作目录", risk: "high" },
  { key: "encryptCredentials", title: "凭证加密存储", desc: "使用系统钥匙串加密", risk: "critical" },
  { key: "groupChatEnabled", title: "启用群聊", desc: "默认仅私聊可用", risk: "medium" },
  { key: "promptScanEnabled", title: "Prompt 注入扫描", desc: "检测提示词中的注入攻击", risk: "high" },
];

interface SecurityDialogProps {
  open: boolean;
  onClose: () => void;
  daemonRunning: boolean;
}

export default function SecurityDialog({ open, onClose, daemonRunning }: SecurityDialogProps) {
  const [config, setConfig] = useState<SecurityConfig>(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const data = await window.clawbox?.getSecurityConfig();
        if (data) setConfig(data);
      } catch { /* */ }
      setLoaded(true);
    })();
  }, [open]);

  // Auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.clawbox?.saveSecurityConfig(config);
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [config, loaded]);

  const toggle = (key: BooleanKey) => {
    setConfig((c) => ({ ...c, [key]: !c[key] }));
  };

  const isItemActive = (item: PolicyItem) => {
    if (item.key === "groupChatEnabled") return !config[item.key];
    return config[item.key];
  };

  const safeCount = allItems.filter(isItemActive).length;
  const totalChecks = allItems.length;

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
          <motion.div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative bg-white rounded-3xl w-[480px] max-h-[70vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-[14px] font-medium text-neutral-700">安全策略</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  {safeCount}/{totalChecks} 项策略已启用
                  {!daemonRunning && " · Gateway 未启动，策略暂未生效"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setConfig(defaults)}
                  className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                >
                  恢复默认
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-400 transition-colors duration-200">
                  <X size={14} />
                </motion.button>
              </div>
            </div>

            {/* Policy toggles */}
            <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-2">
              {allItems.map((item) => {
                const active = isItemActive(item);
                return (
                  <div key={item.key} className="bg-neutral-100 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-300 ${
                          active ? "bg-emerald-500" : item.risk === "critical" ? "bg-red-400" : item.risk === "high" ? "bg-amber-400" : "bg-neutral-300"
                        }`} />
                        <span className="text-[11px] font-medium text-neutral-700">{item.title}</span>
                        {!active && (
                          <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${
                            item.risk === "critical" ? "bg-[#FFF1F2] text-[#E11D48]" :
                            item.risk === "high" ? "bg-[#FFFBEB] text-[#D97706]" :
                            "bg-neutral-200 text-neutral-500"
                          }`}>
                            {item.risk === "critical" ? "严重风险" : item.risk === "high" ? "高风险" : "注意"}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5 ml-3.5">{item.desc}</div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggle(item.key)}
                      className={`w-9 h-5 rounded-full relative flex-shrink-0 transition-colors duration-200 ${
                        config[item.key] ? "bg-neutral-800" : "bg-neutral-200"
                      }`}
                    >
                      <motion.div
                        className="absolute top-0.5 w-4 h-4 bg-white rounded-full"
                        animate={{ left: config[item.key] ? 18 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
