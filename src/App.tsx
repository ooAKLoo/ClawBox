import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./components/Sidebar";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Assistants from "./pages/Assistants";
import Channels from "./pages/Channels";
import Model from "./pages/Model";
import Security from "./pages/Security";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import type { SecurityAlert } from "./types/global";

const pages = {
  dashboard: Dashboard,
  assistants: Assistants,
  channels: Channels,
  model: Model,
  security: Security,
  logs: Logs,
  settings: Settings,
} as const;

export type PageKey = keyof typeof pages;

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);

  useEffect(() => {
    (async () => {
      try {
        if (window.clawbox) {
          const complete = await window.clawbox.getOnboardingComplete();
          setShowOnboarding(!complete);
        } else {
          // Not in Electron — use localStorage fallback
          const complete = localStorage.getItem("clawbox-onboarding-complete") === "true";
          setShowOnboarding(!complete);
        }
      } catch {
        setShowOnboarding(false);
      }
    })();
  }, []);

  // Listen for security alerts from main process
  useEffect(() => {
    if (!window.clawbox?.onSecurityAlert) return;
    const unsub = window.clawbox.onSecurityAlert((alert) => {
      setAlerts((prev) => {
        // Deduplicate by id
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev];
      });
    });
    return unsub;
  }, []);

  // Listen for onboarding reset from Settings page
  useEffect(() => {
    const handler = () => {
      setActivePage("dashboard");
      setShowOnboarding(true);
    };
    window.addEventListener("clawbox-reset-onboarding", handler);
    return () => window.removeEventListener("clawbox-reset-onboarding", handler);
  }, []);

  // Listen for page navigation events from child pages
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent<PageKey>).detail;
      if (target in pages) setActivePage(target);
    };
    window.addEventListener("clawbox-navigate", handler);
    return () => window.removeEventListener("clawbox-navigate", handler);
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    window.clawbox?.dismissSecurityAlert(alertId);
  }, []);

  const handleAlertAction = useCallback((alert: SecurityAlert) => {
    if (alert.action === "go-security") {
      setActivePage("security");
    }
    dismissAlert(alert.id);
  }, [dismissAlert]);

  // Loading state
  if (showOnboarding === null) {
    return (
      <div className="h-screen bg-[#f8f8f8] flex items-center justify-center">
        <div className="text-[11px] text-neutral-400">加载中...</div>
      </div>
    );
  }

  // Onboarding
  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  const ActiveComponent = pages[activePage];

  return (
    <div className="h-screen bg-[#f8f8f8] flex">
      {/* Titlebar drag region */}
      <div className="fixed top-0 left-0 right-0 h-12 titlebar-drag z-50" />

      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <main className="flex-1 min-w-0 pt-12 p-3 pl-0">
        <div className="bg-white rounded-3xl h-full overflow-hidden flex flex-col">
          {/* Security alert banners */}
          <AnimatePresence>
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex-shrink-0 overflow-hidden"
              >
                <div className={`px-4 py-2.5 flex items-center gap-3 ${
                  alert.level === "error" ? "bg-[#FFF1F2]" : "bg-[#FFFBEB]"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    alert.level === "error" ? "bg-[#FF3B30]" : "bg-[#FF9F0A]"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-medium ${
                      alert.level === "error" ? "text-[#E11D48]" : "text-[#D97706]"
                    }`}>
                      {alert.title}
                    </span>
                    <span className={`text-[10px] ml-2 ${
                      alert.level === "error" ? "text-[#E11D48]/70" : "text-[#D97706]/70"
                    }`}>
                      {alert.detail}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {alert.action && (
                      <button
                        onClick={() => handleAlertAction(alert)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-lg ${
                          alert.level === "error"
                            ? "bg-[#E11D48] text-white"
                            : "bg-[#D97706] text-white"
                        }`}
                      >
                        前往处理
                      </button>
                    )}
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className={`text-[10px] font-medium px-2 py-1 rounded-lg ${
                        alert.level === "error"
                          ? "text-[#E11D48] bg-[#E11D48]/10"
                          : "text-[#D97706] bg-[#D97706]/10"
                      }`}
                    >
                      忽略
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Page content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={activePage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, pointerEvents: "auto" as const }}
                exit={{ opacity: 0, y: 8, pointerEvents: "none" as const }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="h-full overflow-y-auto p-6"
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
