import { motion } from "framer-motion";
import type { PageKey } from "../App";

const navItems: { key: PageKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "首页", icon: "⬡" },
  { key: "model", label: "模型", icon: "◇" },
  { key: "feishu", label: "飞书", icon: "◈" },
  { key: "security", label: "安全", icon: "◉" },
  { key: "logs", label: "日志", icon: "≡" },
  { key: "settings", label: "设置", icon: "⚙" },
];

interface SidebarProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <nav className="w-16 pt-14 pb-3 flex flex-col items-center gap-1">
      {navItems.map((item) => (
        <motion.button
          key={item.key}
          onClick={() => onNavigate(item.key)}
          whileTap={{ scale: 0.9 }}
          className="relative w-10 h-10 flex flex-col items-center justify-center rounded-xl"
        >
          {activePage === item.key && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 bg-neutral-100 rounded-xl"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span
            className={`relative z-[1] text-sm leading-none transition-colors duration-200 ${
              activePage === item.key ? "text-neutral-700" : "text-neutral-400"
            }`}
          >
            {item.icon}
          </span>
          <span
            className={`relative z-[1] text-[8px] mt-0.5 font-medium transition-colors duration-200 ${
              activePage === item.key ? "text-neutral-700" : "text-neutral-400"
            }`}
          >
            {item.label}
          </span>
        </motion.button>
      ))}
    </nav>
  );
}
