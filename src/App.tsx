import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./components/Sidebar";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Model from "./pages/Model";
import Feishu from "./pages/Feishu";
import Security from "./pages/Security";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";

const pages = {
  dashboard: Dashboard,
  model: Model,
  feishu: Feishu,
  security: Security,
  logs: Logs,
  settings: Settings,
} as const;

export type PageKey = keyof typeof pages;

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const complete = await window.clawbox?.getOnboardingComplete();
        setShowOnboarding(!complete);
      } catch {
        // Not in Electron — skip onboarding
        setShowOnboarding(false);
      }
    })();
  }, []);

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
        <div className="bg-white rounded-3xl h-full overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full overflow-y-auto p-6"
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
