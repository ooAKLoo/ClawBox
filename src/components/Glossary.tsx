import { useState, useRef } from "react";
import {
  useFloating,
  useHover,
  useInteractions,
  useDismiss,
  offset,
  flip,
  shift,
  arrow,
  FloatingArrow,
  FloatingPortal,
  useTransitionStyles,
  safePolygon,
} from "@floating-ui/react";

// ─── Glossary dictionary ─────────────────────────────────────────────
// key: technical term (exact match)
// plain: one-line plain-language explanation for non-technical users

const glossary: Record<string, string> = {
  // Infrastructure
  Gateway: "运行在你电脑上的一个小服务，OpenClaw 通过它来收发消息",
  Daemon: "在后台持续运行的服务程序，保证助手随时在线响应",
  OpenClaw: "ClawBox 内置的助手引擎，驱动所有 AI 对话和任务执行",
  "Web 控制台": "OpenClaw 自带的浏览器管理页面，可以查看对话记录、调试助手、监控运行状态等",
  "Node.js": "JavaScript 运行环境，OpenClaw 引擎依赖它来运行",

  // AI / Model
  "API Key": "访问 AI 服务的密钥凭证，类似于一把专属钥匙",
  "Base URL": "AI 服务的网络地址，告诉程序去哪里发送请求",
  Token: "AI 处理文本的最小单位，大约 1 个汉字 ≈ 1-2 个 Token",
  Provider: "AI 模型服务商，如 OpenAI、Anthropic、DeepSeek 等",
  Model: "OpenClaw 的大脑——OpenClaw 负责执行任务，但需要接入一个模型来理解和思考问题",
  模型: "OpenClaw 的大脑——OpenClaw 负责执行任务，但需要接入一个模型来理解和思考问题",
  通道: "助手接收消息的入口，比如飞书机器人、命令行等",
  Prompt: "发送给 AI 的指令文本，决定 AI 如何理解和回应你的需求",
  "System Prompt": "预设给 AI 的角色指令，定义助手的身份、能力边界和回答风格",

  // Security
  Shell: "系统命令行，可以直接控制电脑执行操作",
  Skill: "助手可以调用的一项具体技能，比如查资料、读文件、发消息等",
  Webhook: "一种消息通知机制，当事件发生时自动向指定地址发送数据",
  "Prompt 注入": "一种攻击手段——通过特殊文本诱骗 AI 忽略原始指令，执行恶意操作",

  // Communication
  群聊: "多人对话场景；群内任何成员都可以 @机器人触发响应，攻击面比私聊更大，建议仅对可信群开放",

  // Feishu / Channel
  "App ID": "飞书应用的唯一标识符，相当于应用的身份证号",
  "App Secret": "飞书应用的密钥，与 App ID 配合使用来验证身份",
  WebSocket: "一种实时双向通信协议，让消息能即时送达，无需反复请求",
  "Verification Token": "飞书用来验证请求来源真实性的校验码",
  "Encrypt Key": "飞书消息的加密密钥，用于保护传输中的数据不被窃取",

  // General
  CLI: "命令行工具，通过输入文字指令来操作程序（非图形界面）",
  Stable: "正式稳定版本，经过充分测试，适合日常使用",
};

export { glossary };

// ─── <Term> component ────────────────────────────────────────────────

interface TermProps {
  /** The glossary key — must exist in the dictionary above */
  k: string;
  /** Optional display text override (defaults to the key itself) */
  children?: string;
}

export default function Term({ k, children }: TermProps) {
  const explanation = glossary[k];
  const [open, setOpen] = useState(false);
  const arrowRef = useRef(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "top",
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ["bottom", "right", "left"] }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
  });

  const hover = useHover(context, {
    delay: { open: 200, close: 0 },
    handleClose: safePolygon(),
  });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss]);

  const { styles: transitionStyles } = useTransitionStyles(context, {
    duration: { open: 150, close: 100 },
    initial: { opacity: 0, transform: "translateY(4px)" },
    open: { opacity: 1, transform: "translateY(0)" },
    close: { opacity: 0, transform: "translateY(4px)" },
  });

  // If the term isn't in the glossary, render plain text
  if (!explanation) {
    return <span>{children || k}</span>;
  }

  return (
    <>
      <span
        ref={refs.setReference}
        {...getReferenceProps()}
        className="decoration-neutral-300 decoration-dashed underline underline-offset-2 cursor-help"
      >
        {children || k}
      </span>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[9999]"
          >
            <div style={transitionStyles}>
              <div className="bg-neutral-800 text-white rounded-lg px-3 py-2 max-w-[240px]">
                <div className="text-[10px] font-medium leading-relaxed">{explanation}</div>
              </div>
              <FloatingArrow
                ref={arrowRef}
                context={context}
                className="fill-neutral-800"
                width={10}
                height={5}
              />
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
