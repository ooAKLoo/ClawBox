import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Scene template types ---

interface SceneParam {
  key: string;
  label: string;
  type: "text" | "select" | "time" | "tags";
  default?: string;
  options?: { label: string; value: string }[];
}

interface SceneTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  params: SceneParam[];
  category: string;
}

interface Assistant {
  id: string;
  name: string;
  icon: string;
  sceneId: string | null;
  status: "running" | "paused" | "error";
  trigger: string;
  model: string;
  lastRun: string | null;
}

// --- Built-in scene templates ---

const SCENES: SceneTemplate[] = [
  {
    id: "daily-news",
    name: "每日新闻摘要",
    description: "定时搜集指定领域新闻，整理成中文简报推送",
    icon: "news",
    tags: ["定时", "搜索", "消息"],
    category: "信息",
    params: [
      { key: "time", label: "推送时间", type: "time", default: "08:00" },
      {
        key: "topics",
        label: "关注领域",
        type: "tags",
        default: "AI,科技,商业",
      },
    ],
  },
  {
    id: "meeting-notes",
    name: "会议纪要助手",
    description: "收到会议记录后自动提取要点、待办和决策",
    icon: "notes",
    tags: ["消息", "文本处理"],
    category: "效率",
    params: [
      {
        key: "style",
        label: "输出风格",
        type: "select",
        default: "structured",
        options: [
          { label: "结构化要点", value: "structured" },
          { label: "叙述式摘要", value: "narrative" },
        ],
      },
    ],
  },
  {
    id: "translate",
    name: "翻译助手",
    description: "收到消息后自动翻译为目标语言，保持原文风格",
    icon: "translate",
    tags: ["消息", "文本处理"],
    category: "效率",
    params: [
      {
        key: "targetLang",
        label: "目标语言",
        type: "select",
        default: "en",
        options: [
          { label: "英语", value: "en" },
          { label: "日语", value: "ja" },
          { label: "中文", value: "zh" },
        ],
      },
    ],
  },
  {
    id: "daily-report",
    name: "日报生成器",
    description: "汇总当天工作记录，自动生成结构化日报",
    icon: "report",
    tags: ["定时", "消息"],
    category: "效率",
    params: [
      { key: "time", label: "生成时间", type: "time", default: "18:00" },
      {
        key: "format",
        label: "日报格式",
        type: "select",
        default: "bullet",
        options: [
          { label: "要点列表", value: "bullet" },
          { label: "按项目分组", value: "project" },
        ],
      },
    ],
  },
  {
    id: "reminder",
    name: "智能提醒",
    description: "基于自然语言设置提醒，到时间自动推送",
    icon: "reminder",
    tags: ["定时", "消息"],
    category: "生活",
    params: [],
  },
  {
    id: "code-review",
    name: "代码审查助手",
    description: "收到代码片段后给出审查意见和改进建议",
    icon: "code",
    tags: ["消息", "文本处理"],
    category: "开发",
    params: [
      {
        key: "lang",
        label: "主要语言",
        type: "select",
        default: "typescript",
        options: [
          { label: "TypeScript", value: "typescript" },
          { label: "Python", value: "python" },
          { label: "Go", value: "go" },
          { label: "Rust", value: "rust" },
        ],
      },
    ],
  },
];

const SCENE_ICONS: Record<string, string> = {
  news: "\u25C8",
  notes: "\u2261",
  translate: "\u25C7",
  report: "\u25A3",
  reminder: "\u25CB",
  code: "\u27E8\u27E9",
};

const CATEGORIES = ["全部", "效率", "信息", "生活", "开发"];

export default function Assistants() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [setupScene, setSetupScene] = useState<SceneTemplate | null>(null);
  const [setupParams, setSetupParams] = useState<Record<string, string>>({});
  const [createMode, setCreateMode] = useState(false);
  const [createPrompt, setCreatePrompt] = useState("");

  const filteredScenes =
    activeCategory === "全部"
      ? SCENES
      : SCENES.filter((s) => s.category === activeCategory);

  const handleUseScene = (scene: SceneTemplate) => {
    const defaults: Record<string, string> = {};
    scene.params.forEach((p) => {
      if (p.default) defaults[p.key] = p.default;
    });
    setSetupParams(defaults);
    setSetupScene(scene);
  };

  const handleConfirmSetup = () => {
    if (!setupScene) return;
    const newAssistant: Assistant = {
      id: `ast-${Date.now()}`,
      name: setupScene.name,
      icon: setupScene.icon,
      sceneId: setupScene.id,
      status: "running",
      trigger:
        setupParams.time ? `每天 ${setupParams.time}` : "收到消息时",
      model: "继承全局",
      lastRun: null,
    };
    setAssistants((prev) => [newAssistant, ...prev]);
    setSetupScene(null);
    setSetupParams({});
  };

  const handleCreateFromPrompt = () => {
    if (!createPrompt.trim()) return;
    const newAssistant: Assistant = {
      id: `ast-${Date.now()}`,
      name: createPrompt.slice(0, 20) + (createPrompt.length > 20 ? "..." : ""),
      icon: "news",
      sceneId: null,
      status: "running",
      trigger: "收到消息时",
      model: "继承全局",
      lastRun: null,
    };
    setAssistants((prev) => [newAssistant, ...prev]);
    setCreateMode(false);
    setCreatePrompt("");
  };

  const toggleAssistant = (id: string) => {
    setAssistants((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: a.status === "running" ? "paused" : "running" }
          : a
      )
    );
  };

  const removeAssistant = (id: string) => {
    setAssistants((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[14px] font-medium text-neutral-700">助手</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            从场景模板创建，或用自然语言描述你想要的助手
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setCreateMode(true)}
          className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-800 text-white"
        >
          + 新建助手
        </motion.button>
      </div>

      {/* My assistants */}
      {assistants.length > 0 && (
        <div className="mb-6">
          <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
            我的助手
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {assistants.map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="bg-neutral-100 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[13px] text-neutral-500 flex-shrink-0">
                        {SCENE_ICONS[a.icon] || "\u25C6"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-neutral-700 truncate">
                          {a.name}
                        </div>
                        <div className="text-[9px] text-neutral-400 mt-0.5">
                          {a.trigger} · {a.model}
                          {a.lastRun ? ` · ${a.lastRun}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            a.status === "running"
                              ? "bg-emerald-500"
                              : a.status === "error"
                                ? "bg-red-400"
                                : "bg-neutral-300"
                          }`}
                        />
                        <span className="text-[9px] text-neutral-400">
                          {a.status === "running"
                            ? "运行中"
                            : a.status === "error"
                              ? "异常"
                              : "已暂停"}
                        </span>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleAssistant(a.id)}
                        className="text-[9px] font-medium px-2 py-1 rounded-lg bg-white text-neutral-500 hover:bg-neutral-200"
                      >
                        {a.status === "running" ? "暂停" : "启用"}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeAssistant(a.id)}
                        className="text-[9px] font-medium px-2 py-1 rounded-lg bg-white text-neutral-400 hover:bg-neutral-200"
                      >
                        移除
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Scene market */}
      <div>
        <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
          {assistants.length > 0 ? "发现更多场景" : "推荐场景"}
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 mb-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="relative px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap z-[1]"
            >
              {activeCategory === cat && (
                <motion.div
                  layoutId="scene-cat-active"
                  className="absolute inset-0 bg-neutral-800 rounded-lg"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span
                className={`relative z-[1] transition-colors duration-200 ${
                  activeCategory === cat ? "text-white" : "text-neutral-500"
                }`}
              >
                {cat}
              </span>
            </button>
          ))}
        </div>

        {/* Scene cards grid */}
        <div className="grid grid-cols-2 gap-3">
          {filteredScenes.map((scene) => (
            <div key={scene.id} className="bg-neutral-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-xl bg-white flex items-center justify-center text-[12px] text-neutral-500">
                  {SCENE_ICONS[scene.icon] || "\u25C6"}
                </div>
                <div className="text-[11px] font-medium text-neutral-700">
                  {scene.name}
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 mb-3 leading-4">
                {scene.description}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {scene.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[8px] font-medium text-neutral-400 bg-neutral-200 px-1.5 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleUseScene(scene)}
                  className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-800 text-white"
                >
                  使用
                </motion.button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Setup dialog — scene params */}
      <AnimatePresence>
        {setupScene && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
            onClick={() => setSetupScene(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-3xl w-[420px] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-xl bg-neutral-100 flex items-center justify-center text-[12px] text-neutral-500">
                  {SCENE_ICONS[setupScene.icon] || "\u25C6"}
                </div>
                <div className="text-[14px] font-medium text-neutral-700">
                  {setupScene.name}
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 mb-4">
                {setupScene.description}
              </p>

              {setupScene.params.length > 0 ? (
                <div className="bg-neutral-100 rounded-2xl p-4 space-y-3 mb-4">
                  {setupScene.params.map((param) => (
                    <div key={param.key} className="bg-white rounded-xl p-3">
                      <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
                        {param.label}
                      </label>
                      {param.type === "select" && param.options ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {param.options.map((opt) => (
                            <motion.button
                              key={opt.value}
                              whileTap={{ scale: 0.95 }}
                              onClick={() =>
                                setSetupParams((p) => ({
                                  ...p,
                                  [param.key]: opt.value,
                                }))
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors duration-200 ${
                                setupParams[param.key] === opt.value
                                  ? "bg-neutral-800 text-white"
                                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                              }`}
                            >
                              {opt.label}
                            </motion.button>
                          ))}
                        </div>
                      ) : (
                        <input
                          value={setupParams[param.key] || ""}
                          onChange={(e) =>
                            setSetupParams((p) => ({
                              ...p,
                              [param.key]: e.target.value,
                            }))
                          }
                          placeholder={param.default || ""}
                          className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-neutral-100 rounded-2xl p-4 mb-4">
                  <p className="text-[10px] text-neutral-400">
                    无需额外配置，直接启用即可
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSetupScene(null)}
                  className="text-[10px] font-medium px-4 py-2 rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                >
                  取消
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleConfirmSetup}
                  className="text-[10px] font-medium px-4 py-2 rounded-lg bg-neutral-800 text-white"
                >
                  启用助手
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create from prompt dialog */}
      <AnimatePresence>
        {createMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
            onClick={() => setCreateMode(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-3xl w-[420px] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[14px] font-medium text-neutral-700 mb-1">
                创建助手
              </div>
              <p className="text-[10px] text-neutral-400 mb-4">
                用一句话描述你想让助手做什么，系统会自动配置所需能力
              </p>

              <div className="bg-neutral-100 rounded-2xl p-4 mb-4">
                <div className="bg-white rounded-xl p-3">
                  <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">
                    描述
                  </label>
                  <textarea
                    value={createPrompt}
                    onChange={(e) => setCreatePrompt(e.target.value)}
                    placeholder="例如：每天帮我搜集 AI 领域的最新动态，整理成中文简报"
                    rows={3}
                    className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setCreateMode(false)}
                  className="text-[10px] font-medium px-4 py-2 rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                >
                  取消
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreateFromPrompt}
                  disabled={!createPrompt.trim()}
                  className={`text-[10px] font-medium px-4 py-2 rounded-lg ${
                    createPrompt.trim()
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-200 text-neutral-400"
                  }`}
                >
                  创建
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
