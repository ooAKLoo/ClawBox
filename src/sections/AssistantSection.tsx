import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SkillInfo, PluginInfo } from "../types/global";

// ── Plugin kind labels & colors ──

const KIND_META: Record<string, { label: string; color: string; bg: string }> = {
  channel: { label: "通道", color: "text-[#2563EB]", bg: "bg-[#EFF6FF]" },
  memory:  { label: "记忆", color: "text-[#7C3AED]", bg: "bg-[#FAF5FF]" },
  provider:{ label: "模型", color: "text-[#059669]", bg: "bg-[#ECFDF5]" },
};

type Tab = "skills" | "plugins";

export default function AssistantSection() {
  const [tab, setTab] = useState<Tab>("skills");
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [sk, pl] = await Promise.all([
          window.clawbox?.listSkills(),
          window.clawbox?.listPlugins(),
        ]);
        if (sk) setSkills(sk);
        if (pl) setPlugins(pl);
      } catch { /* */ }
      setLoading(false);
    })();
  }, []);

  const handleToggleSkill = async (name: string, enable: boolean) => {
    setTogglingId(name);
    const result = await window.clawbox?.toggleSkill(name, enable);
    if (result?.success) {
      setSkills((prev) => prev.map((s) => s.name === name ? { ...s, enabled: enable } : s));
    }
    setTogglingId(null);
  };

  const handleTogglePlugin = async (id: string, enable: boolean) => {
    setTogglingId(id);
    const result = await window.clawbox?.togglePlugin(id, enable);
    if (result?.success) {
      setPlugins((prev) => prev.map((p) => p.id === id ? { ...p, enabled: enable } : p));
    }
    setTogglingId(null);
  };

  // ── Filtered lists ──

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const q = searchQuery.toLowerCase();
    return skills.filter((s) =>
      s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }, [skills, searchQuery]);

  const filteredPlugins = useMemo(() => {
    if (!searchQuery.trim()) return plugins;
    const q = searchQuery.toLowerCase();
    return plugins.filter((p) =>
      p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) ||
      p.channels.some((c) => c.toLowerCase().includes(q))
    );
  }, [plugins, searchQuery]);

  // ── Stats ──

  const enabledSkills = skills.filter((s) => s.enabled).length;
  const enabledPlugins = plugins.filter((p) => p.enabled).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-3">
        <div className="text-[11px] font-medium text-neutral-700">扩展</div>
        <div className="text-[10px] text-neutral-400 mt-0.5">
          {loading ? "加载中..." : `${enabledSkills} 个 Skill 启用 · ${enabledPlugins} 个 Plugin 启用 · 共 ${skills.length + plugins.length} 个`}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 bg-neutral-200 rounded-lg p-0.5 mb-3">
        {(["skills", "plugins"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearchQuery(""); }}
            className="relative flex-1 py-1.5 text-[10px] font-medium rounded-md z-[1]"
          >
            {tab === t && (
              <motion.div
                layoutId="extensions-tab-indicator"
                className="absolute inset-0 bg-white rounded-md"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className={`relative z-[1] transition-colors duration-200 ${tab === t ? "text-neutral-800" : "text-neutral-400"}`}>
              {t === "skills" ? `Skills (${skills.length})` : `Plugins (${plugins.length})`}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={tab === "skills" ? "搜索 Skill..." : "搜索 Plugin..."}
        className="w-full bg-neutral-100 rounded-xl px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300 mb-3"
      />

      {/* Content */}
      {loading ? (
        <div className="text-[10px] text-neutral-400 text-center py-8">正在读取 OpenClaw 扩展...</div>
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          {tab === "skills" ? (
            <motion.div
              key="skills"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <SkillsList
                skills={filteredSkills}
                togglingId={togglingId}
                onToggle={handleToggleSkill}
              />
            </motion.div>
          ) : (
            <motion.div
              key="plugins"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <PluginsList
                plugins={filteredPlugins}
                togglingId={togglingId}
                onToggle={handleTogglePlugin}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ── Skills List ──

function SkillsList({ skills, togglingId, onToggle }: {
  skills: SkillInfo[];
  togglingId: string | null;
  onToggle: (name: string, enable: boolean) => void;
}) {
  if (skills.length === 0) {
    return <div className="text-[10px] text-neutral-400 text-center py-6">没有找到 Skill</div>;
  }

  // Group: enabled first, then eligible, then unavailable
  const enabled = skills.filter((s) => s.enabled);
  const available = skills.filter((s) => !s.enabled && s.eligible);
  const unavailable = skills.filter((s) => !s.enabled && !s.eligible);

  return (
    <div className="space-y-3">
      {enabled.length > 0 && (
        <div>
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">已启用</div>
          <div className="space-y-1.5">
            {enabled.map((s) => (
              <SkillRow key={s.name} skill={s} toggling={togglingId === s.name} onToggle={onToggle} />
            ))}
          </div>
        </div>
      )}
      {available.length > 0 && (
        <div>
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">可用</div>
          <div className="space-y-1.5">
            {available.map((s) => (
              <SkillRow key={s.name} skill={s} toggling={togglingId === s.name} onToggle={onToggle} />
            ))}
          </div>
        </div>
      )}
      {unavailable.length > 0 && (
        <div>
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">需安装依赖</div>
          <div className="space-y-1.5">
            {unavailable.map((s) => (
              <SkillRow key={s.name} skill={s} toggling={togglingId === s.name} onToggle={onToggle} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillRow({ skill, toggling, onToggle }: {
  skill: SkillInfo;
  toggling: boolean;
  onToggle: (name: string, enable: boolean) => void;
}) {
  return (
    <div className="bg-neutral-100 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[13px] flex-shrink-0">
          {skill.emoji || "⚡"}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-medium text-neutral-700 truncate">{skill.name}</div>
          {skill.description && (
            <div className="text-[9px] text-neutral-400 truncate mt-0.5">{skill.description}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!skill.eligible && skill.requires.bins.length > 0 && (
          <span className="text-[8px] font-medium px-1.5 py-0.5 rounded text-amber-600 bg-[#FFFBEB]">
            {skill.requires.bins[0]}
          </span>
        )}
        {skill.os.length > 0 && !skill.os.includes("darwin") && !skill.os.includes(navigator.platform.startsWith("Mac") ? "darwin" : "linux") && (
          <span className="text-[8px] font-medium px-1.5 py-0.5 rounded text-neutral-400 bg-neutral-200">
            {skill.os.join(", ")}
          </span>
        )}
        <motion.button
          whileTap={toggling ? undefined : { scale: 0.9 }}
          onClick={() => onToggle(skill.name, !skill.enabled)}
          disabled={toggling || !skill.eligible}
          className={`text-[9px] font-medium px-2.5 py-1 rounded-lg transition-colors duration-200 ${
            toggling ? "bg-neutral-200 text-neutral-300 cursor-not-allowed"
            : !skill.eligible ? "bg-neutral-200 text-neutral-300 cursor-not-allowed"
            : skill.enabled ? "bg-neutral-800 text-white" : "bg-white text-neutral-500 hover:bg-neutral-200"
          }`}
        >
          {toggling ? "..." : skill.enabled ? "已启用" : "启用"}
        </motion.button>
      </div>
    </div>
  );
}

// ── Plugins List ──

function PluginsList({ plugins, togglingId, onToggle }: {
  plugins: PluginInfo[];
  togglingId: string | null;
  onToggle: (id: string, enable: boolean) => void;
}) {
  if (plugins.length === 0) {
    return <div className="text-[10px] text-neutral-400 text-center py-6">没有找到 Plugin</div>;
  }

  // Group by kind
  const channels = plugins.filter((p) => p.kind === "channel" || p.channels.length > 0);
  const memory = plugins.filter((p) => p.kind === "memory");
  const others = plugins.filter((p) => p.kind !== "channel" && p.kind !== "memory" && p.channels.length === 0);

  return (
    <div className="space-y-3">
      {channels.length > 0 && (
        <PluginGroup label="通道" plugins={channels} togglingId={togglingId} onToggle={onToggle} />
      )}
      {memory.length > 0 && (
        <PluginGroup label="记忆" plugins={memory} togglingId={togglingId} onToggle={onToggle} />
      )}
      {others.length > 0 && (
        <PluginGroup label="工具" plugins={others} togglingId={togglingId} onToggle={onToggle} />
      )}
    </div>
  );
}

function PluginGroup({ label, plugins, togglingId, onToggle }: {
  label: string;
  plugins: PluginInfo[];
  togglingId: string | null;
  onToggle: (id: string, enable: boolean) => void;
}) {
  return (
    <div>
      <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-2">{label}</div>
      <div className="space-y-1.5">
        {plugins.map((p) => (
          <PluginRow key={p.id} plugin={p} toggling={togglingId === p.id} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

function PluginRow({ plugin, toggling, onToggle }: {
  plugin: PluginInfo;
  toggling: boolean;
  onToggle: (id: string, enable: boolean) => void;
}) {
  const meta = KIND_META[plugin.kind];

  return (
    <div className="bg-neutral-100 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-neutral-700">{plugin.id}</span>
            {meta && (
              <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${meta.color} ${meta.bg}`}>
                {meta.label}
              </span>
            )}
          </div>
          {plugin.channels.length > 0 && (
            <div className="text-[9px] text-neutral-400 mt-0.5">{plugin.channels.join(", ")}</div>
          )}
        </div>
      </div>
      <motion.button
        whileTap={toggling ? undefined : { scale: 0.9 }}
        onClick={() => onToggle(plugin.id, !plugin.enabled)}
        disabled={toggling}
        className={`text-[9px] font-medium px-2.5 py-1 rounded-lg transition-colors duration-200 ${
          toggling ? "bg-neutral-200 text-neutral-300 cursor-not-allowed"
          : plugin.enabled ? "bg-neutral-800 text-white" : "bg-white text-neutral-500 hover:bg-neutral-200"
        }`}
      >
        {toggling ? "..." : plugin.enabled ? "已启用" : "启用"}
      </motion.button>
    </div>
  );
}
