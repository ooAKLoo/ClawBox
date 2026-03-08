import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AssistantConfig } from "../types/global";

// --- Scene templates (same as original) ---

interface SceneParam {
  key: string;
  label: string;
  type: "text" | "select" | "time" | "tags" | "textarea";
  default?: string;
  placeholder?: string;
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
  systemPrompt: string;
  requires?: "channel";
}

const SCENES: SceneTemplate[] = [
  {
    id: "ai-customer-service",
    name: "AI 客服",
    description: "接入飞书后自动回答客户咨询，记住沟通历史",
    icon: "service",
    tags: ["通道", "消息", "记忆"],
    category: "客服",
    requires: "channel",
    params: [
      { key: "productInfo", label: "产品/业务资料", type: "textarea", placeholder: "粘贴产品介绍、常见问题、报价等" },
      { key: "fallback", label: "超出能力时的行为", type: "select", default: "handoff", options: [{ label: "转人工提示", value: "handoff" }, { label: "礼貌拒绝", value: "decline" }] },
    ],
    systemPrompt: `你是一个专业的 AI 客服助手。你的职责是：\n1. 根据产品资料准确回答客户的咨询\n2. 记住每位客户的历史对话\n3. 回答要简洁、专业、友好\n4. 遇到不确定的问题，不要编造答案`,
  },
  {
    id: "meeting-notes",
    name: "会议纪要助手",
    description: "收到会议记录后自动提取要点、待办和决策",
    icon: "notes",
    tags: ["消息", "文本处理"],
    category: "效率",
    params: [
      { key: "style", label: "输出风格", type: "select", default: "structured", options: [{ label: "结构化要点", value: "structured" }, { label: "叙述式摘要", value: "narrative" }] },
    ],
    systemPrompt: `你是一个会议纪要助手。收到会议记录时：\n1. 提取关键讨论要点\n2. 列出所有决策事项\n3. 整理待办任务\n4. 简要总结结论`,
  },
  {
    id: "translate",
    name: "翻译助手",
    description: "收到消息后自动翻译为目标语言",
    icon: "translate",
    tags: ["消息", "文本处理"],
    category: "效率",
    params: [
      { key: "targetLang", label: "目标语言", type: "select", default: "en", options: [{ label: "英语", value: "en" }, { label: "日语", value: "ja" }, { label: "中文", value: "zh" }] },
    ],
    systemPrompt: `你是一个专业翻译助手。收到消息后：\n1. 自动检测源语言\n2. 翻译为目标语言\n3. 保持原文语气和风格\n4. 专业术语附上原文`,
  },
  {
    id: "daily-report",
    name: "日报生成器",
    description: "汇总当天工作记录，自动生成日报",
    icon: "report",
    tags: ["定时", "消息"],
    category: "效率",
    params: [
      { key: "time", label: "生成时间", type: "time", default: "18:00" },
      { key: "format", label: "日报格式", type: "select", default: "bullet", options: [{ label: "要点列表", value: "bullet" }, { label: "按项目分组", value: "project" }] },
    ],
    systemPrompt: `你是一个日报生成助手。\n1. 收集整理当天工作内容\n2. 按指定格式生成日报\n3. 突出完成的任务和进展\n4. 列出问题和明日计划`,
  },
  {
    id: "code-review",
    name: "代码审查助手",
    description: "收到代码片段后给出审查意见",
    icon: "code",
    tags: ["消息", "文本处理"],
    category: "开发",
    params: [
      { key: "lang", label: "主要语言", type: "select", default: "typescript", options: [{ label: "TypeScript", value: "typescript" }, { label: "Python", value: "python" }, { label: "Go", value: "go" }, { label: "Rust", value: "rust" }] },
    ],
    systemPrompt: `你是一个代码审查助手。收到代码时：\n1. 检查代码质量和潜在 bug\n2. 评估安全性\n3. 建议性能优化\n4. 提出可读性改进`,
  },
];

const SCENE_ICONS: Record<string, string> = {
  service: "\u2637",
  notes: "\u2261",
  translate: "\u25C7",
  report: "\u25A3",
  code: "\u27E8\u27E9",
};

function buildSystemPrompt(scene: SceneTemplate, params: Record<string, string>): string {
  let prompt = scene.systemPrompt;
  const additions: string[] = [];
  for (const p of scene.params) {
    const val = params[p.key];
    if (!val) continue;
    if (p.key === "productInfo" && val.trim()) additions.push(`## 产品资料\n${val}`);
    if (p.key === "fallback") additions.push(val === "handoff" ? `超出能力范围时: 回复转人工提示` : `超出能力范围时: 礼貌拒绝`);
    if (p.key === "targetLang") additions.push(`目标语言: ${p.options?.find((o) => o.value === val)?.label ?? val}`);
    if (p.key === "style") additions.push(`输出风格: ${p.options?.find((o) => o.value === val)?.label ?? val}`);
    if (p.key === "format") additions.push(`日报格式: ${p.options?.find((o) => o.value === val)?.label ?? val}`);
    if (p.key === "lang") additions.push(`主要编程语言: ${p.options?.find((o) => o.value === val)?.label ?? val}`);
  }
  if (additions.length > 0) prompt += `\n\n## 用户配置\n${additions.map((a) => `- ${a}`).join("\n")}`;
  return prompt;
}

function deriveTrigger(_scene: SceneTemplate, params: Record<string, string>): string {
  if (params.time) return `每天 ${params.time}`;
  return "收到消息时";
}

export default function AssistantSection() {
  const [assistants, setAssistants] = useState<AssistantConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupScene, setSetupScene] = useState<SceneTemplate | null>(null);
  const [setupParams, setSetupParams] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [createPrompt, setCreatePrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [channelReady, setChannelReady] = useState<boolean | null>(null);
  const [showChannelHint, setShowChannelHint] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [list, feishuCfg] = await Promise.all([
          window.clawbox?.listAssistants(),
          window.clawbox?.getFeishuConfig(),
        ]);
        if (list) setAssistants(list);
        setChannelReady(!!(feishuCfg?.appId && feishuCfg?.appSecret));
      } catch { /* */ }
      setLoading(false);
    })();
  }, []);

  const handleUseScene = (scene: SceneTemplate) => {
    if (scene.requires === "channel" && !channelReady) {
      setShowChannelHint(true);
      return;
    }
    const defaults: Record<string, string> = {};
    scene.params.forEach((p) => { if (p.default) defaults[p.key] = p.default; });
    setSetupParams(defaults);
    setSetupScene(scene);
    setError(null);
  };

  const handleConfirmSetup = async () => {
    if (!setupScene) return;
    setCreating(true);
    setError(null);
    const trigger = deriveTrigger(setupScene, setupParams);
    const systemPrompt = buildSystemPrompt(setupScene, setupParams);
    try {
      const result = await window.clawbox?.createAssistant({
        name: setupScene.name, icon: setupScene.icon, sceneId: setupScene.id,
        status: "running", trigger, systemPrompt, params: setupParams,
      });
      if (result?.success && result.assistant) {
        setAssistants((prev) => [result.assistant!, ...prev]);
        setSetupScene(null);
        setSetupParams({});
      } else {
        setError(result?.error || "创建失败");
      }
    } catch (err) { setError(String(err)); }
    setCreating(false);
  };

  const handleCreateFromPrompt = async () => {
    if (!createPrompt.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const result = await window.clawbox?.createAssistant({
        name: createPrompt.slice(0, 20) + (createPrompt.length > 20 ? "..." : ""),
        icon: "news", sceneId: null, status: "running",
        trigger: "收到消息时", systemPrompt: createPrompt, params: {},
      });
      if (result?.success && result.assistant) {
        setAssistants((prev) => [result.assistant!, ...prev]);
        setCreateMode(false);
        setCreatePrompt("");
      } else {
        setError(result?.error || "创建失败");
      }
    } catch (err) { setError(String(err)); }
    setCreating(false);
  };

  const toggleAssistant = async (id: string) => {
    const result = await window.clawbox?.toggleAssistant(id);
    if (result?.success) {
      setAssistants((prev) => prev.map((a) => a.id === id ? { ...a, status: a.status === "running" ? "paused" : "running" } : a));
    }
  };

  const removeAssistant = async (id: string) => {
    const result = await window.clawbox?.removeAssistant(id);
    if (result?.success) {
      setAssistants((prev) => prev.filter((a) => a.id !== id));
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] font-medium text-neutral-700">助手</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            {assistants.length > 0 ? `${assistants.filter((a) => a.status === "running").length} 个运行中 · 共 ${assistants.length} 个` : "从场景模板创建，或用自然语言描述"}
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { setCreateMode(true); setError(null); }}
          className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-neutral-800 text-white"
        >
          + 新建助手
        </motion.button>
      </div>

      {/* My assistants */}
      {loading ? (
        <div className="text-[10px] text-neutral-400 text-center py-6">加载中...</div>
      ) : assistants.length > 0 ? (
        <div className="space-y-2 mb-4">
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
                      <div className="text-[11px] font-medium text-neutral-700 truncate">{a.name}</div>
                      <div className="text-[9px] text-neutral-400 mt-0.5">{a.trigger} · 继承全局模型</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${a.status === "running" ? "bg-emerald-500" : "bg-neutral-300"}`} />
                      <span className="text-[9px] text-neutral-400">{a.status === "running" ? "运行中" : "已暂停"}</span>
                    </div>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleAssistant(a.id)} className="text-[9px] font-medium px-2 py-1 rounded-lg bg-white text-neutral-500 hover:bg-neutral-200">
                      {a.status === "running" ? "暂停" : "启用"}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => removeAssistant(a.id)} className="text-[9px] font-medium px-2 py-1 rounded-lg bg-white text-neutral-400 hover:bg-neutral-200">
                      移除
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : null}

      {/* Scene templates */}
      <div className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-3">
        {assistants.length > 0 ? "发现更多场景" : "推荐场景"}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SCENES.map((scene) => (
          <div key={scene.id} className="bg-neutral-100 rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[11px] text-neutral-500">
                {SCENE_ICONS[scene.icon] || "\u25C6"}
              </div>
              <div className="text-[10px] font-medium text-neutral-700">{scene.name}</div>
            </div>
            <p className="text-[9px] text-neutral-400 mb-2 leading-3.5">{scene.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1 flex-wrap">
                {scene.requires === "channel" && (
                  <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${channelReady ? "text-emerald-600 bg-[#ECFDF5]" : "text-amber-600 bg-[#FFFBEB]"}`}>
                    {channelReady ? "通道已连接" : "需配置通道"}
                  </span>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleUseScene(scene)}
                className="text-[9px] font-medium px-2.5 py-1 rounded-lg bg-neutral-800 text-white"
              >
                使用
              </motion.button>
            </div>
          </div>
        ))}
      </div>

      {/* Setup dialog */}
      <AnimatePresence>
        {setupScene && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
            onClick={() => { if (!creating) setSetupScene(null); }}
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
                <div className="text-[14px] font-medium text-neutral-700">{setupScene.name}</div>
              </div>
              <p className="text-[10px] text-neutral-400 mb-4">{setupScene.description}</p>

              {setupScene.params.length > 0 ? (
                <div className="bg-neutral-100 rounded-2xl p-4 space-y-3 mb-4">
                  {setupScene.params.map((param) => (
                    <div key={param.key} className="bg-white rounded-xl p-3">
                      <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">{param.label}</label>
                      {param.type === "select" && param.options ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {param.options.map((opt) => (
                            <motion.button
                              key={opt.value}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setSetupParams((p) => ({ ...p, [param.key]: opt.value }))}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors duration-200 ${
                                setupParams[param.key] === opt.value ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                              }`}
                            >
                              {opt.label}
                            </motion.button>
                          ))}
                        </div>
                      ) : param.type === "textarea" ? (
                        <textarea
                          value={setupParams[param.key] || ""}
                          onChange={(e) => setSetupParams((p) => ({ ...p, [param.key]: e.target.value }))}
                          placeholder={param.placeholder || ""}
                          rows={4}
                          className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300 resize-none"
                        />
                      ) : (
                        <input
                          value={setupParams[param.key] || ""}
                          onChange={(e) => setSetupParams((p) => ({ ...p, [param.key]: e.target.value }))}
                          placeholder={param.placeholder || param.default || ""}
                          className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-neutral-100 rounded-2xl p-4 mb-4">
                  <p className="text-[10px] text-neutral-400">无需额外配置，直接启用即可</p>
                </div>
              )}

              {error && (
                <div className="mb-3 px-3 py-2 bg-[#FFF1F2] rounded-xl">
                  <p className="text-[10px] text-[#E11D48]">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSetupScene(null)} disabled={creating} className="text-[10px] font-medium px-4 py-2 rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200">
                  取消
                </motion.button>
                <motion.button
                  whileTap={creating ? undefined : { scale: 0.97 }}
                  onClick={handleConfirmSetup}
                  disabled={creating}
                  className={`text-[10px] font-medium px-4 py-2 rounded-lg ${creating ? "bg-neutral-300 text-neutral-500 cursor-not-allowed" : "bg-neutral-800 text-white"}`}
                >
                  {creating ? "创建中..." : "启用助手"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Channel hint dialog */}
      <AnimatePresence>
        {showChannelHint && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowChannelHint(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2, ease: "easeOut" }} className="bg-white rounded-3xl w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="text-[14px] font-medium text-neutral-700 mb-1">需要先配置通道</div>
              <p className="text-[10px] text-neutral-400 mb-4 leading-4">该助手需要接入飞书等消息通道才能工作。</p>
              <div className="bg-[#FFFBEB] rounded-2xl p-4 mb-4">
                <p className="text-[10px] text-amber-700 font-medium mb-1">请先完成：</p>
                <ol className="text-[10px] text-amber-600 space-y-1 list-decimal list-inside">
                  <li>在上方「通道」卡片中配置飞书应用凭证</li>
                  <li>完成飞书通道激活</li>
                  <li>返回创建 AI 客服助手</li>
                </ol>
              </div>
              <div className="flex justify-end">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowChannelHint(false)} className="text-[10px] font-medium px-4 py-2 rounded-lg bg-neutral-800 text-white">
                  知道了
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create from prompt dialog */}
      <AnimatePresence>
        {createMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => { if (!creating) setCreateMode(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2, ease: "easeOut" }} className="bg-white rounded-3xl w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="text-[14px] font-medium text-neutral-700 mb-1">创建助手</div>
              <p className="text-[10px] text-neutral-400 mb-4">用一句话描述你想让助手做什么</p>
              <div className="bg-neutral-100 rounded-2xl p-4 mb-4">
                <div className="bg-white rounded-xl p-3">
                  <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5 block">描述</label>
                  <textarea
                    value={createPrompt}
                    onChange={(e) => setCreatePrompt(e.target.value)}
                    placeholder="例如：收到英文邮件后自动翻译成中文并总结要点"
                    rows={3}
                    className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-[11px] text-neutral-700 font-medium outline-none placeholder:text-neutral-300 resize-none"
                  />
                </div>
              </div>
              {error && (
                <div className="mb-3 px-3 py-2 bg-[#FFF1F2] rounded-xl">
                  <p className="text-[10px] text-[#E11D48]">{error}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setCreateMode(false)} disabled={creating} className="text-[10px] font-medium px-4 py-2 rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200">
                  取消
                </motion.button>
                <motion.button
                  whileTap={creating ? undefined : { scale: 0.97 }}
                  onClick={handleCreateFromPrompt}
                  disabled={!createPrompt.trim() || creating}
                  className={`text-[10px] font-medium px-4 py-2 rounded-lg ${createPrompt.trim() && !creating ? "bg-neutral-800 text-white" : "bg-neutral-200 text-neutral-400 cursor-not-allowed"}`}
                >
                  {creating ? "创建中..." : "创建"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
