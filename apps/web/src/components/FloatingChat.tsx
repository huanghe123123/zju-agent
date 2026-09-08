import { useEffect, useRef, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { useFloatingChatStore } from "../stores/useFloatingChat.js";
import {
  useConversations,
  useConversation,
  useSendMessage,
  useConfirmTool,
  useDeleteConversation,
  type AgentEvent,
  type ChatMessage,
} from "../api/agent.js";

type PendingConfirmation = {
  confirmationId: string;
  toolName: string;
  summary: string;
  inputPreview: unknown;
};

type ToolStep = {
  id: string;
  name: string;
  input: unknown;
  status: "running" | "executing" | "done" | "failed";
  result?: unknown;
};

type LiveState = {
  assistantText: string;
  toolSteps: ToolStep[];
  thinking: boolean;
};

function initialLive(): LiveState {
  return { assistantText: "", toolSteps: [], thinking: false };
}

const QUICK_PROMPTS = [
  "📅 今天有什么课？",
  "📝 最近有什么作业要交？",
  "📋 查一下这学期的考试安排",
  "📚 总结一下本学期的所有课程",
];

export function FloatingChat() {
  const {
    isOpen,
    isMinimized,
    isExpanded,
    activeConversationId,
    position,
    closeChat,
    toggleChat,
    minimizeChat,
    restoreChat,
    toggleExpand,
    setPosition,
    setActiveConversationId,
  } = useFloatingChatStore();

  const { data: conversations } = useConversations();
  const delConv = useDeleteConversation();

  // 默认自动选择第一个会话
  useEffect(() => {
    if (!activeConversationId && conversations && conversations.length > 0) {
      setActiveConversationId(conversations[0]!.id);
    }
  }, [activeConversationId, conversations, setActiveConversationId]);

  const [showConvDropdown, setShowConvDropdown] = useState(false);

  // 窗口尺寸
  const windowWidth = isExpanded ? 680 : 420;
  const windowHeight = isExpanded ? 700 : 560;

  // 窗口初始位置计算（默认右下角浮动）
  useEffect(() => {
    if (position === null && typeof window !== "undefined") {
      const x = Math.max(16, window.innerWidth - windowWidth - 24);
      const y = Math.max(16, window.innerHeight - windowHeight - 24);
      setPosition({ x, y });
    }
  }, [position, windowWidth, windowHeight, setPosition]);

  // 拖拽逻辑
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    // 忽略按钮、输入框、下拉框等交互元素的拖拽
    if ((e.target as HTMLElement).closest("button, input, select, textarea, a")) {
      return;
    }
    const currentX = position?.x ?? Math.max(16, window.innerWidth - windowWidth - 24);
    const currentY = position?.y ?? Math.max(16, window.innerHeight - windowHeight - 24);

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: currentX,
      initY: currentY,
    };
    setIsDragging(true);

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!dragRef.current) return;
      const deltaX = moveEvt.clientX - dragRef.current.startX;
      const deltaY = moveEvt.clientY - dragRef.current.startY;
      const maxX = Math.max(0, window.innerWidth - windowWidth);
      const maxY = Math.max(0, window.innerHeight - windowHeight);

      const nextX = Math.min(maxX, Math.max(0, dragRef.current.initX + deltaX));
      const nextY = Math.min(maxY, Math.max(0, dragRef.current.initY + deltaY));
      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const activeConv = useMemo(
    () => (conversations ?? []).find((c) => c.id === activeConversationId),
    [conversations, activeConversationId],
  );

  return (
    <>
      {/* 浮动入口按钮（未打开或最小化时显示） */}
      {(!isOpen || isMinimized) && (
        <button
          onClick={isOpen && isMinimized ? restoreChat : toggleChat}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex items-center gap-2 rounded-full bg-zju-primary px-4 py-3 text-white shadow-xl hover:bg-zju-light hover:shadow-2xl active:scale-95 transition-all duration-200 group"
          title="打开 AI 校园助手"
        >
          <span className="text-xl">💬</span>
          <span className="text-sm font-semibold tracking-wide">AI 助手</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
        </button>
      )}

      {/* 浮动对话窗口 */}
      {isOpen && !isMinimized && (
        <div
          className={`fixed z-50 flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-2xl transition-shadow ${
            isDragging ? "select-none shadow-3xl opacity-95" : ""
          }`}
          style={{
            left: position
              ? Math.min(Math.max(12, position.x), Math.max(12, (typeof window !== "undefined" ? window.innerWidth : 1000) - windowWidth - 12))
              : Math.max(12, (typeof window !== "undefined" ? window.innerWidth : 1000) - windowWidth - 24),
            top: position
              ? Math.min(Math.max(12, position.y), Math.max(12, (typeof window !== "undefined" ? window.innerHeight : 800) - windowHeight - 12))
              : Math.max(12, (typeof window !== "undefined" ? window.innerHeight : 800) - windowHeight - 24),
            width: windowWidth,
            height: windowHeight,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: "calc(100vh - 84px)",
          }}
        >
          {/* 窗口头部：拖拽手柄 + 会话切换 + 最小化/最大化/关闭按钮 */}
          <div
            onPointerDown={handlePointerDown}
            className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-3.5 py-2.5 rounded-t-2xl cursor-grab active:cursor-grabbing select-none"
          >
            {/* 左侧：拖拽指示器与标题 */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-slate-400 text-sm font-bold tracking-tighter" title="拖拽移动浮窗">
                ⋮⋮
              </span>
              <span className="text-base">💬</span>
              <div className="relative">
                <button
                  onClick={() => setShowConvDropdown((v) => !v)}
                  className="flex items-center gap-1 text-sm font-semibold text-slate-800 hover:text-zju-primary transition truncate max-w-[180px]"
                >
                  <span className="truncate">{activeConv?.title || "新对话"}</span>
                  <span className="text-[10px] text-slate-400">▾</span>
                </button>

                {/* 会话下拉切换菜单 */}
                {showConvDropdown && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <button
                      onClick={() => {
                        setActiveConversationId(null);
                        setShowConvDropdown(false);
                      }}
                      className="flex w-full items-center gap-1.5 rounded-lg bg-zju-primary/10 px-2.5 py-1.5 text-xs font-semibold text-zju-primary hover:bg-zju-primary/20 transition mb-1"
                    >
                      <span>+</span>
                      <span>开启新对话</span>
                    </button>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {(conversations ?? []).map((c) => (
                        <div
                          key={c.id}
                          className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-xs ${
                            activeConversationId === c.id
                              ? "bg-slate-100 font-medium text-slate-900"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <button
                            onClick={() => {
                              setActiveConversationId(c.id);
                              setShowConvDropdown(false);
                            }}
                            className="truncate text-left flex-1"
                            title={c.title}
                          >
                            {c.title}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              delConv.mutate(c.id);
                              if (activeConversationId === c.id) setActiveConversationId(null);
                            }}
                            className="hidden text-slate-400 hover:text-rose-500 group-hover:block px-1"
                            title="删除会话"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {(conversations ?? []).length === 0 && (
                        <div className="py-2 text-center text-xs text-slate-400">暂无历史会话</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：操作按钮组 */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setActiveConversationId(null);
                  setShowConvDropdown(false);
                }}
                className="size-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/60 hover:text-slate-700 transition"
                title="开启新对话"
              >
                +
              </button>
              <button
                onClick={toggleExpand}
                className="size-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/60 hover:text-slate-700 transition text-xs"
                title={isExpanded ? "收起窗口" : "展开窗口"}
              >
                {isExpanded ? "⤡" : "⤢"}
              </button>
              <button
                onClick={minimizeChat}
                className="size-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/60 hover:text-slate-700 transition text-xs font-bold"
                title="最小化"
              >
                —
              </button>
              <button
                onClick={closeChat}
                className="size-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition text-xs font-bold"
                title="关闭浮窗"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 窗口内容主体 */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30">
            {activeConversationId ? (
              <ActiveConversationContent
                conversationId={activeConversationId}
              />
            ) : (
              <NewConversationContent
                onCreated={(id) => setActiveConversationId(id)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** 既有会话对话内容区 */
function ActiveConversationContent({
  conversationId,
}: {
  conversationId: string;
}) {
  const { prefillPrompt, setPrefillPrompt } = useFloatingChatStore();
  const [draft, setDraft] = useState("");
  const conv = useConversation(conversationId);
  const history = conv.data?.messages ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<LiveState>(initialLive());
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const send = useSendMessage();
  const confirm = useConfirmTool();

  useEffect(() => {
    if (prefillPrompt) {
      setDraft(prefillPrompt);
      setPrefillPrompt(null);
    }
  }, [prefillPrompt, setPrefillPrompt]);

  // 滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, live]);

  function handleEvent(e: AgentEvent) {
    switch (e.type) {
      case "confirmation_required":
        setPending({
          confirmationId: e.confirmationId,
          toolName: e.toolName,
          summary: e.summary,
          inputPreview: e.inputPreview,
        });
        break;
      case "error":
        setError(e.message);
        break;
      case "done":
        break;
      default:
        break;
    }
    setLive((prev) => {
      const next = { ...prev, toolSteps: [...prev.toolSteps] };
      switch (e.type) {
        case "text":
          next.assistantText = prev.assistantText + e.delta;
          next.thinking = false;
          break;
        case "tool_call_start":
          if (!prev.toolSteps.some((s) => s.id === e.toolCall.id)) {
            next.toolSteps = [
              ...prev.toolSteps,
              { id: e.toolCall.id, name: e.toolCall.name, input: e.toolCall.input, status: "running" },
            ];
          }
          break;
        case "tool_call_end": {
          const idx = prev.toolSteps.findIndex((s) => s.id === e.toolCall.id);
          if (idx === -1) {
            next.toolSteps = [
              ...prev.toolSteps,
              { id: e.toolCall.id, name: e.toolCall.name, input: e.toolCall.input, status: "executing" },
            ];
          } else {
            next.toolSteps = prev.toolSteps.map((s) =>
              s.id === e.toolCall.id
                ? { ...s, name: s.name || e.toolCall.name, input: e.toolCall.input, status: s.status === "running" ? "executing" : s.status }
                : s,
            );
          }
          break;
        }
        case "tool_result":
          next.toolSteps = prev.toolSteps.map((s) =>
            s.id === e.toolCallId ? { ...s, status: e.ok ? "done" : "failed", result: e.result } : s,
          );
          break;
        case "done":
          return { ...prev, thinking: false };
      }
      return next;
    });
  }

  async function onSend(text: string) {
    if (!text.trim() || send.isPending) return;
    setError(null);
    setLive({ assistantText: "", toolSteps: [], thinking: true });
    try {
      await send.mutateAsync({
        conversationId,
        message: text,
        onEvent: handleEvent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    }
  }

  async function onConfirm(decision: "approve" | "reject") {
    if (!pending || confirm.isPending) return;
    setLive((p) => ({ ...p, thinking: true }));
    try {
      await confirm.mutateAsync({
        confirmationId: pending.confirmationId,
        decision,
        onEvent: handleEvent,
      });
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认失败");
    }
  }

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* 消息滚动区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.map((m) => (
          <HistoryBubble key={m.id} message={m} />
        ))}
        <LiveBubble state={live} />
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {error}
          </div>
        )}
      </div>

      {/* 底部确认栏或输入区 */}
      {pending ? (
        <ConfirmBar pending={pending} onConfirm={onConfirm} pending2={confirm.isPending} />
      ) : (
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={(text) => {
            setDraft("");
            void onSend(text);
          }}
          disabled={send.isPending}
        />
      )}
    </div>
  );
}

/** 新建会话内容区（含预设快捷引导） */
function NewConversationContent({
  onCreated,
}: {
  onCreated: (id: string) => void;
}) {
  const { prefillPrompt, setPrefillPrompt } = useFloatingChatStore();
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<LiveState>(initialLive());
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const send = useSendMessage();
  const confirm = useConfirmTool();

  useEffect(() => {
    if (prefillPrompt) {
      setDraft(prefillPrompt);
      setPrefillPrompt(null);
    }
  }, [prefillPrompt, setPrefillPrompt]);

  function handleEvent(e: AgentEvent) {
    switch (e.type) {
      case "confirmation_required":
        setPending({
          confirmationId: e.confirmationId,
          toolName: e.toolName,
          summary: e.summary,
          inputPreview: e.inputPreview,
        });
        break;
      case "error":
        setError(e.message);
        break;
      case "done":
        if (e.conversationId) {
          onCreated(e.conversationId);
        }
        break;
      default:
        break;
    }
    setLive((prev) => {
      const next = { ...prev, toolSteps: [...prev.toolSteps] };
      switch (e.type) {
        case "text":
          next.assistantText = prev.assistantText + e.delta;
          next.thinking = false;
          break;
        case "tool_call_start":
          if (!prev.toolSteps.some((s) => s.id === e.toolCall.id)) {
            next.toolSteps = [
              ...prev.toolSteps,
              { id: e.toolCall.id, name: e.toolCall.name, input: e.toolCall.input, status: "running" },
            ];
          }
          break;
        case "tool_call_end": {
          const idx = prev.toolSteps.findIndex((s) => s.id === e.toolCall.id);
          if (idx === -1) {
            next.toolSteps = [
              ...prev.toolSteps,
              { id: e.toolCall.id, name: e.toolCall.name, input: e.toolCall.input, status: "executing" },
            ];
          } else {
            next.toolSteps = prev.toolSteps.map((s) =>
              s.id === e.toolCall.id
                ? { ...s, name: s.name || e.toolCall.name, input: e.toolCall.input, status: s.status === "running" ? "executing" : s.status }
                : s,
            );
          }
          break;
        }
        case "tool_result":
          next.toolSteps = prev.toolSteps.map((s) =>
            s.id === e.toolCallId ? { ...s, status: e.ok ? "done" : "failed", result: e.result } : s,
          );
          break;
        case "done":
          return { ...prev, thinking: false };
      }
      return next;
    });
  }

  async function onSend(text: string) {
    if (!text.trim() || send.isPending) return;
    setError(null);
    setDraft("");
    setLive({ assistantText: "", toolSteps: [], thinking: true });
    try {
      await send.mutateAsync({ message: text, onEvent: handleEvent });
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    }
  }

  async function onConfirm(decision: "approve" | "reject") {
    if (!pending || confirm.isPending) return;
    setLive((p) => ({ ...p, thinking: true }));
    try {
      await confirm.mutateAsync({
        confirmationId: pending.confirmationId,
        decision,
        onEvent: handleEvent,
      });
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认失败");
    }
  }

  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col justify-center items-center text-center">
        <div className="size-12 rounded-2xl bg-zju-primary/10 flex items-center justify-center text-2xl mb-1">
          🤖
        </div>
        <h3 className="font-semibold text-slate-800 text-sm">浙大校园智能助手</h3>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          我是你的专属 AI 助教，可以随时为你查询课表、作业、考场或下载课件。
        </p>

        {/* 快捷提问气泡 */}
        <div className="w-full pt-3 space-y-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSend(prompt.slice(2).trim())}
              disabled={send.isPending}
              className="w-full text-left rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-700 hover:border-zju-primary hover:text-zju-primary hover:bg-slate-50/80 transition shadow-2xs"
            >
              {prompt}
            </button>
          ))}
        </div>

        <LiveBubble state={live} />
        {error && (
          <div className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {error}
          </div>
        )}
      </div>

      {pending ? (
        <ConfirmBar pending={pending} onConfirm={onConfirm} pending2={confirm.isPending} />
      ) : (
        <Composer value={draft} onChange={setDraft} onSend={onSend} disabled={send.isPending} />
      )}
    </div>
  );
}

function LiveBubble({ state }: { state: LiveState }) {
  if (!state.thinking && !state.assistantText && state.toolSteps.length === 0) return null;
  return (
    <div className="w-full mb-3 text-left">
      {state.thinking && !state.assistantText && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="size-1.5 rounded-full bg-zju-primary animate-pulse"></span>
          <span>思考中…</span>
        </div>
      )}
      {state.toolSteps.length > 0 && (
        <div className="mb-2 space-y-1">
          {state.toolSteps.map((s) => (
            <ToolStepView key={s.id} step={s} />
          ))}
        </div>
      )}
      {state.assistantText && <Bubble role="assistant">{state.assistantText}</Bubble>}
    </div>
  );
}

function ToolStepView({ step }: { step: ToolStep }) {
  const icon = step.status === "done" ? "✓" : step.status === "failed" ? "✕" : "⋯";
  const color =
    step.status === "done"
      ? "text-emerald-600"
      : step.status === "failed"
        ? "text-rose-500"
        : "text-slate-400";
  const label = toolLabel(step.name);
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-1.5 text-xs shadow-2xs">
      <div className="flex items-center gap-1.5">
        <span className={`${color} font-bold`}>{icon}</span>
        <span className="font-medium text-slate-700">{label}</span>
      </div>
      {step.result != null && (
        <div className="mt-1 max-h-20 overflow-auto rounded bg-slate-50 p-1 font-mono text-[10px] text-slate-500">
          {summarizeResult(step.result)}
        </div>
      )}
    </div>
  );
}

function toolLabel(name: string): string {
  const map: Record<string, string> = {
    zju_get_courses: "查询课程",
    zju_get_assignments: "查询作业",
    zju_get_course_materials: "查询课件",
    zju_get_quizzes: "查询小测",
    zju_get_exams: "查询考试",
    zju_get_timetable: "查询课表",
    zju_get_upcoming_schedule: "查询日程流",
    zju_download_course_material: "下载课件",
  };
  return map[name] ?? name;
}

function HistoryBubble({ message }: { message: ChatMessage }) {
  if (message.role === "tool" || message.role === "system") return null;
  if (message.role === "assistant" && message.metadata?.toolCalls && !message.content) {
    const calls = message.metadata.toolCalls;
    return (
      <div className="mb-2 space-y-1">
        {calls.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-600">
            <span className="text-emerald-600 font-bold">✓</span> {toolLabel(c.name)}
          </div>
        ))}
      </div>
    );
  }
  return <Bubble role={message.role === "user" ? "user" : "assistant"}>{message.content}</Bubble>;
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  const content = typeof children === "string" ? children : "";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2.5`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
          isUser
            ? "bg-zju-primary text-white rounded-br-xs shadow-xs"
            : "border border-slate-200/80 bg-white text-slate-800 rounded-bl-xs shadow-xs prose prose-xs prose-slate max-w-none"
        }`}
      >
        {isUser ? children : <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>}
      </div>
    </div>
  );
}

const markdownComponents: Components = {
  ul({ children }) {
    return <div className="space-y-1 my-1.5 not-prose">{children}</div>;
  },
  ol({ children }) {
    return <div className="space-y-1 my-1.5 not-prose">{children}</div>;
  },
  li({ children }) {
    return (
      <div className="rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-1 text-xs">
        {children}
      </div>
    );
  },
  code({ children }) {
    const text = String(children ?? "");
    return text.includes("\n") ? (
      <pre className="my-1.5 overflow-auto rounded-md bg-slate-800 p-2 text-[11px] text-emerald-100 font-mono">
        <code>{text}</code>
      </pre>
    ) : (
      <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-mono text-slate-700">
        {text}
      </code>
    );
  },
};

function Composer({
  onSend,
  disabled,
  value,
  onChange,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [internal, setInternal] = useState("");
  const text = value ?? internal;
  const setText = (v: string) => {
    setInternal(v);
    onChange?.(v);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend(text);
        if (!onChange) setInternal("");
      }}
      className="border-t border-slate-100 bg-white p-2.5 rounded-b-2xl"
    >
      <div className="flex items-center gap-1.5">
        <input
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs focus:border-zju-primary focus:bg-white focus:outline-none transition"
          placeholder="问问 AI 助手（如：明天有什么课）…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="rounded-xl bg-zju-primary px-3.5 py-2 text-xs font-medium text-white hover:bg-zju-light disabled:opacity-40 transition shadow-2xs"
        >
          {disabled ? "…" : "发送"}
        </button>
      </div>
    </form>
  );
}

function ConfirmBar({
  pending,
  onConfirm,
  pending2,
}: {
  pending: PendingConfirmation;
  onConfirm: (d: "approve" | "reject") => void;
  pending2: boolean;
}) {
  return (
    <div className="border-t border-amber-200 bg-amber-50 p-2.5 rounded-b-2xl text-xs">
      <div className="mb-1 text-amber-800 font-medium">
        🔔 执行确认：<span className="font-mono">{toolLabel(pending.toolName)}</span>
      </div>
      <div className="mb-2 rounded bg-white/80 p-1.5 font-mono text-[10px] text-slate-600 truncate">
        {pending.summary}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => onConfirm("approve")}
          disabled={pending2}
          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50 font-medium"
        >
          {pending2 ? "执行中…" : "同意"}
        </button>
        <button
          onClick={() => onConfirm("reject")}
          disabled={pending2}
          className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          拒绝
        </button>
      </div>
    </div>
  );
}

function summarizeResult(result: unknown): string {
  try {
    const s = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return s.length > 300 ? s.slice(0, 300) + "…" : s;
  } catch {
    return String(result);
  }
}
