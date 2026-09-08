import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Layout, RightPanel } from "../components/Layout.js";
import { useApiFetch } from "../api/bootstrap.js";
import { useAuthStatus } from "../api/auth.js";
import {
  useConversations,
  useConversation,
  useSendMessage,
  useConfirmTool,
  useDeleteConversation,
  type AgentEvent,
  type ChatMessage,
} from "../api/agent.js";
import {
  useAllAssignments,
  useExams,
  useUpcomingSchedule48h,
} from "../api/zju.js";

type PendingConfirmation = {
  confirmationId: string;
  toolName: string;
  summary: string;
  inputPreview: unknown;
};

export function ChatPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [explicitNewChat, setExplicitNewChat] = useState(false);
  const { data: conversations } = useConversations();
  const delConv = useDeleteConversation();

  const conv = useConversation(activeId);

  // 自动选第一条（仅在非显式新建对话时）
  useEffect(() => {
    if (!activeId && !explicitNewChat && conversations && conversations.length > 0) {
      setActiveId(conversations[0]!.id);
    }
  }, [activeId, explicitNewChat, conversations]);

  return (
    <Layout rightPanel={<DashboardPanel />}>
      <div className="flex h-[calc(100vh-3rem)] gap-3">
        {/* 会话列表 */}
        <aside className="hidden w-48 shrink-0 flex-col border-r border-slate-200 md:flex">
          <button
            onClick={() => {
              setActiveId(null);
              setExplicitNewChat(true);
            }}
            className="m-2 rounded-md bg-zju-primary px-3 py-2 text-sm text-white hover:bg-zju-light"
          >
            + 新对话
          </button>
          <div className="flex-1 overflow-auto px-2 pb-2">
            {(conversations ?? []).map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                  activeId === c.id
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <button
                  onClick={() => {
                    setActiveId(c.id);
                    setExplicitNewChat(false);
                  }}
                  className="min-w-0 flex-1 truncate text-left"
                  title={c.title}
                >
                  {c.title}
                </button>
                <button
                  onClick={() => {
                    delConv.mutate(c.id);
                    if (activeId === c.id) setActiveId(null);
                  }}
                  className="hidden shrink-0 text-slate-400 hover:text-rose-500 group-hover:block"
                  title="删除"
                >
                  ✕
                </button>
              </div>
            ))}
            {(conversations ?? []).length === 0 && (
              <div className="px-2 py-3 text-xs text-slate-400">暂无会话</div>
            )}
          </div>
        </aside>

        {/* 主对话区 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeId && conv.data ? (
            <ConversationView
              conversationId={activeId}
              history={conv.data.messages}
            />
          ) : (
            <NewConversationView
              onCreated={(id) => {
                setActiveId(id);
                setExplicitNewChat(false);
              }}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

/** 右栏 Dashboard 面板（Celechron 48小时日程流 + 48小时折叠作业） */
function DashboardPanel() {
  const apiFetch = useApiFetch();
  const { data: upcomingData, isLoading: scheduleLoading } = useUpcomingSchedule48h();
  const { data: assignments } = useAllAssignments();
  const { data: exams } = useExams();
  const { data: authStatus, isLoading: authLoading } = useAuthStatus();
  const loggedIn = authStatus?.ok ?? false;

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/settings");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "加载设置失败");
      return json.data as {
        modelProviders?: Array<{
          id: string;
          name: string;
          protocol: string;
          baseUrl: string;
          model: string;
          enabled: boolean;
        }>;
        credentials?: {
          hasZjuCredential: boolean;
          zjuUsernameMasked?: string;
          hasModelApiKey: boolean;
          modelProviderName?: string;
        };
      };
    },
  });

  const activeProvider =
    settingsData?.modelProviders?.find((p) => p.enabled) ??
    settingsData?.modelProviders?.[0];
  const hasModelConfigured =
    settingsData?.credentials?.hasModelApiKey || !!activeProvider?.name;

  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [assignmentsCollapsed, setAssignmentsCollapsed] = useState(true);

  const activePeriod = upcomingData?.activePeriod;
  const laterPeriods = upcomingData?.laterPeriods ?? [];
  const assignments48h = upcomingData?.assignments48h ?? [];
  const dateInfo = upcomingData?.dateInfo;

  const activePending = (assignments ?? []).filter(
    (a) => !a.submitted && (!a.deadline || Date.parse(a.deadline) > nowMs),
  );
  const overdueCount = (assignments ?? []).filter(
    (a) => !a.submitted && a.deadline && Date.parse(a.deadline) <= nowMs,
  ).length;
  const totalPending = activePending.length;
  const totalExams = (exams ?? []).length;

  return (
    <RightPanel title="📊 校园看板">
      <div className="space-y-3.5">
        {/* 校历时间坐标 */}
        {dateInfo && (
          <div className="rounded-xl bg-slate-100 p-2.5 text-xs text-slate-700 space-y-1">
            <div className="flex items-center justify-between font-semibold">
              <span>{dateInfo.academicYear}学年 {dateInfo.term}</span>
              <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px]">
                {dateInfo.weekString}
              </span>
            </div>
            {dateInfo.isHoliday && (
              <div className="text-[11px] text-amber-700 font-medium">
                休：{dateInfo.holidayName ?? "放假停课"}
              </div>
            )}
            {dateInfo.isMakeupDay && (
              <div className="text-[11px] text-purple-700 font-medium">
                调：{dateInfo.holidayName}
              </div>
            )}
          </div>
        )}

        {/* 接下来 48 小时日程流 */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700">
            <span>接下来 48 小时日程</span>
          </div>

          {scheduleLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-400">
              加载日程时空流...
            </div>
          ) : !activePeriod ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
              <span className="text-emerald-600 block font-semibold mb-1">🎉 48小时内无待办日程</span>
              今日与未来48小时暂无课程或考试
            </div>
          ) : (
            <div className="space-y-2">
              {/* 首项 Hero 卡片 */}
              {(() => {
                const startMs = new Date(activePeriod.startIso).getTime();
                const endMs = new Date(activePeriod.endIso).getTime();
                const isOngoing = startMs <= nowMs && nowMs < endMs;
                const liveSec = isOngoing
                  ? Math.max(0, Math.floor((endMs - nowMs) / 1000))
                  : Math.max(0, Math.floor((startMs - nowMs) / 1000));
                const totalDur = Math.max(1, endMs - startMs);
                const progress = isOngoing
                  ? Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / totalDur) * 100)))
                  : 0;

                return (
                  <Link
                    to={activePeriod.type === "class" ? "/courses" : "/exams"}
                    title={activePeriod.type === "class" ? "点击查看课程详情" : "点击查看考场信息"}
                    className="group block rounded-xl border border-blue-200 bg-blue-50/40 p-3 text-xs space-y-1.5 shadow-sm hover:border-blue-400 hover:shadow transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          isOngoing ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isOngoing ? "bg-emerald-500 animate-pulse" : "bg-blue-500"}`} />
                        {isOngoing ? "正在进行" : "即将开始"}
                      </span>
                      <span className="text-slate-500 font-medium">
                        {activePeriod.friendlyTimeStr}
                      </span>
                    </div>

                    <div className="font-bold text-sm text-slate-900 group-hover:text-zju-primary transition-colors truncate">
                      {activePeriod.title}
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="truncate">📍 {activePeriod.location}</span>
                      <span className="font-mono font-bold text-slate-800 group-hover:text-zju-primary transition-colors shrink-0">
                        {formatHMS(liveSec)}
                      </span>
                    </div>

                    {isOngoing && (
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden mt-1">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </Link>
                );
              })()}

              {/* 后续条目 */}
              {laterPeriods.slice(0, 2).map((lp) => (
                <Link
                  key={lp.id}
                  to={lp.type === "class" ? "/courses" : "/exams"}
                  title={lp.type === "class" ? "点击查看课程详情" : "点击查看考场信息"}
                  className="group block rounded-lg border border-slate-200 bg-white p-2.5 text-xs hover:border-blue-300 hover:shadow-sm transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 group-hover:text-zju-primary transition-colors truncate flex-1 mr-2">{lp.title}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">{lp.friendlyTimeStr}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">📍 {lp.location}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 48 小时内截止的作业（默认折叠） */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => setAssignmentsCollapsed((v) => !v)}
            className="w-full flex items-center justify-between p-2.5 text-left hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800">48小时截止作业</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                  assignments48h.length > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {assignments48h.length}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {assignmentsCollapsed ? "展开 ▾" : "折叠 ▴"}
            </span>
          </button>

          {!assignmentsCollapsed && (
            <div className="border-t border-slate-100 bg-slate-50/60 p-2.5 space-y-2">
              {assignments48h.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-1">
                  🎉 近 48 小时无待提交作业
                </div>
              ) : (
                assignments48h.map((a) => {
                  const dueMs = new Date(a.deadlineIso).getTime();
                  const liveSec = Math.max(0, Math.floor((dueMs - nowMs) / 1000));
                  return (
                    <Link
                      key={a.id}
                      to="/assignments"
                      title="点击前往作业中心"
                      className="group block rounded-lg border border-slate-200 bg-white p-2 text-xs space-y-0.5 hover:border-amber-300 hover:shadow-sm transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-blue-50 px-1 text-[10px] text-blue-700 truncate max-w-[120px]">
                          {a.courseName}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-amber-600">
                          {formatHMS(liveSec)}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-800 group-hover:text-amber-700 transition-colors truncate">{a.title}</div>
                      <div className="text-[10px] text-slate-400">{a.dueTimeStr}</div>
                    </Link>
                  );
                })
              )}
              <div className="text-center pt-0.5">
                <Link to="/assignments" className="text-[11px] text-zju-primary hover:underline">
                  前往作业中心 →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* 快捷统计与状态 */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            to={totalPending === 0 && overdueCount > 0 ? "/assignments?tab=overdue" : "/assignments"}
            className="rounded-lg border border-slate-200 bg-white p-2 text-center hover:border-zju-primary transition shadow-xs"
          >
            <div className="text-[10px] text-slate-400">待办作业</div>
            <div className="text-base font-bold text-slate-800">{loggedIn ? `${totalPending} 项` : "—"}</div>
          </Link>
          <Link
            to="/exams"
            className="rounded-lg border border-slate-200 bg-white p-2 text-center hover:border-zju-primary transition shadow-xs"
          >
            <div className="text-[10px] text-slate-400">近期考试</div>
            <div className="text-base font-bold text-slate-800">{loggedIn ? `${totalExams} 场` : "—"}</div>
          </Link>
          <Link
            to={loggedIn ? "/settings#zju" : "/setup"}
            className="rounded-lg border border-slate-200 bg-white p-2 text-center hover:border-zju-primary transition shadow-xs"
          >
            <div className="text-[10px] text-slate-400">ZJU 认证</div>
            <div className={`text-xs font-bold truncate mt-1 ${loggedIn ? "text-emerald-600" : "text-amber-600"}`}>
              {authLoading ? "..." : loggedIn ? (authStatus?.username ?? "已登录") : "未登录"}
            </div>
          </Link>
          <Link
            to="/settings#providers"
            className="rounded-lg border border-slate-200 bg-white p-2 text-center hover:border-zju-primary transition shadow-xs"
          >
            <div className="text-[10px] text-slate-400">模型 API</div>
            <div className={`text-xs font-bold truncate mt-1 ${hasModelConfigured ? "text-emerald-600" : "text-rose-500"}`}>
              {settingsLoading ? "..." : hasModelConfigured ? (activeProvider?.name ?? settingsData?.credentials?.modelProviderName ?? "已配置") : "未配置"}
            </div>
          </Link>
        </div>
      </div>
    </RightPanel>
  );
}

function formatHMS(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ConversationView({
  conversationId,
  history,
}: {
  conversationId: string;
  history: ChatMessage[];
}) {
  const [live, setLive] = useState<LiveState>(initialLive());
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const send = useSendMessage();
  const confirm = useConfirmTool();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 切换会话时重置 live
  useEffect(() => {
    setLive(initialLive());
    setPending(null);
    setError(null);
  }, [conversationId]);

  // 历史消息加载完成后，若 live 内容已存在于 history 中则清除（避免短暂消失→重现的闪烁）
  useEffect(() => {
    if (!live.assistantText) return;
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    if (lastAssistant && lastAssistant.content.trim() === live.assistantText.trim()) {
      setLive(initialLive());
    }
  }, [history, live.assistantText]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [live, pending]);

  function handleEvent(e: AgentEvent) {
    // 副作用（pending/error）放在 updater 外，避免 StrictMode 双触发
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
      default:
        break;
    }
    setLive((prev) => {
      const next = { ...prev, assistantText: prev.assistantText, toolSteps: [...prev.toolSteps] };
      switch (e.type) {
        case "text":
          next.assistantText = prev.assistantText + e.delta;
          next.thinking = false;
          break;
        case "tool_call_start":
          if (!prev.toolSteps.some((s) => s.id === e.toolCall.id)) {
            next.toolSteps = [...prev.toolSteps, { id: e.toolCall.id, name: e.toolCall.name, input: e.toolCall.input, status: "running" }];
          }
          break;
        case "tool_call_end": {
          const idx = prev.toolSteps.findIndex((s) => s.id === e.toolCall.id);
          if (idx === -1) {
            // 兼容未发 tool_call_start 的 provider：补插步骤
            next.toolSteps = [...prev.toolSteps, { id: e.toolCall.id, name: e.toolCall.name, input: e.toolCall.input, status: "executing" }];
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
          if (e.confirmationId == null) {
            // 不立刻清空——等 history 重新拉取到相同内容后再清除，避免闪烁
            return { ...prev, thinking: false };
          }
          break;
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
      // 确认成功后关闭确认框；失败时保留 pending 以便重试
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认失败");
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-2 text-sm text-slate-500">
        会话 · {conversationId.slice(0, 8)}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-4">
        {history.map((m) => (
          <HistoryBubble key={m.id} message={m} />
        ))}
        <LiveBubble state={live} />
        {error && (
          <div className="my-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {error}
          </div>
        )}
      </div>
      {pending ? (
        <ConfirmBar pending={pending} onConfirm={onConfirm} pending2={confirm.isPending} />
      ) : (
        <Composer onSend={onSend} disabled={send.isPending} />
      )}
    </div>
  );
}

function NewConversationView({ onCreated }: { onCreated: (id: string) => void }) {
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<LiveState>(initialLive());
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const send = useSendMessage();
  const confirm = useConfirmTool();

  function handleEvent(e: AgentEvent) {
    // 副作用（pending/error/onCreated）放在 updater 外，避免 StrictMode 双触发
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
          // 先切换到新会话 ID → 父组件会渲染 ConversationView
          // 此时 live 保持不变，ConversationView 的 useEffect 会在 history 追上后清除
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
            next.toolSteps = [...prev.toolSteps, { id: e.toolCall.id, name: e.toolCall.name, input: e.toolCall.input, status: "running" }];
          }
          break;
        case "tool_call_end": {
          const idx = prev.toolSteps.findIndex((s) => s.id === e.toolCall.id);
          if (idx === -1) {
            // 兼容未发 tool_call_start 的 provider：补插步骤
            next.toolSteps = [...prev.toolSteps, { id: e.toolCall.id, name: e.toolCall.name, input: e.toolCall.input, status: "executing" }];
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
      // 确认成功后关闭确认框；失败时保留 pending 以便重试
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认失败");
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-2 text-sm text-slate-500">新对话</div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-3 text-sm text-slate-400">
          试试问：「我最近有什么作业？」「接下来有什么课？」「下周有什么考试？」
        </div>
        <LiveBubble state={live} />
        {error && (
          <div className="my-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
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

/** 让 NewConversationView 在 done 后切换到新建会话 */
// onCreated 通过 props 传入，由父组件 setActiveId 驱动

type LiveState = {
  assistantText: string;
  toolSteps: ToolStep[];
  thinking: boolean;
};

function initialLive(): LiveState {
  return { assistantText: "", toolSteps: [], thinking: false };
}

type ToolStep = {
  id: string;
  name: string;
  input: unknown;
  status: "running" | "executing" | "done" | "failed";
  result?: unknown;
};

function LiveBubble({ state }: { state: LiveState }) {
  if (!state.thinking && !state.assistantText && state.toolSteps.length === 0) return null;
  return (
    <div className="mb-4">
      {state.thinking && !state.assistantText && (
        <div className="mb-2 text-xs text-slate-400">思考中…</div>
      )}
      {state.toolSteps.length > 0 && (
        <div className="mb-2 space-y-1">
          {state.toolSteps.map((s) => (
            <ToolStepView key={s.id} step={s} />
          ))}
        </div>
      )}
      {state.assistantText && (
        <Bubble role="assistant">{state.assistantText}</Bubble>
      )}
    </div>
  );
}

function ToolStepView({ step }: { step: ToolStep }) {
  const icon =
    step.status === "done" ? "✓" : step.status === "failed" ? "✕" : "⋯";
  const color =
    step.status === "done"
      ? "text-emerald-600"
      : step.status === "failed"
        ? "text-rose-500"
        : "text-slate-400";
  const label = toolLabel(step.name);
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs">
      <span className={color}>{icon}</span>{" "}
      <span className="font-mono text-slate-700">{label}</span>
      <span className="ml-1 text-slate-400">
        {summarizeInput(step.input)}
      </span>
      {step.result != null && (
        <div className="mt-1 max-h-24 overflow-auto rounded bg-white/60 p-1 font-mono text-[10px] text-slate-500">
          {summarizeResult(step.result)}
        </div>
      )}
    </div>
  );
}

/** 工具名 → 中文可读标签。重点区分两类"考试"：教务网正式考试 vs 学在浙大课程小测。 */
function toolLabel(name: string): string {
  const map: Record<string, string> = {
    "zju_get_courses": "查询课程（学在浙大）",
    "zju_get_assignments": "查询作业（学在浙大）",
    "zju_get_course_materials": "查询课件（学在浙大）",
    "zju_get_quizzes": "查询课程小测（学在浙大）",
    "zju_get_exams": "查询考试安排（教务网）",
    "zju_get_timetable": "查询课表（教务网）",
    "zju_download_course_material": "下载课件",
  };
  return map[name] ?? name;
}

function HistoryBubble({ message }: { message: ChatMessage }) {
  if (message.role === "tool") return null;
  if (message.role === "system") return null;
    if (message.role === "assistant" && message.metadata?.toolCalls && !message.content) {
    // 纯工具调用消息：在历史里折叠为工具步骤
    const calls = message.metadata.toolCalls;
    return (
      <div className="mb-2 space-y-1">
        {calls.map((c) => (
          <div key={c.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs">
            <span className="text-emerald-600">✓</span>{" "}
            <span className="font-mono text-slate-700">{toolLabel(c.name)}</span>
            <span className="ml-1 text-slate-400">{summarizeInput(c.input)}</span>
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
    <div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
          isUser
            ? "bg-zju-primary text-white"
            : "prose-a:text-zju-primary prose prose-sm prose-slate max-w-none"
        }`}
      >
        {isUser ? (
          children
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}

/** 自定义 Markdown 组件：列表项渲染为卡片 */
const markdownComponents: Components = {
  ul({ children }) {
    return <div className="space-y-1.5 my-2 not-prose">{children}</div>;
  },
  ol({ children }) {
    return <div className="space-y-1.5 my-2 not-prose">{children}</div>;
  },
  li({ children }) {
    // 提取列表项文本，第一行作为标题，后续行作为详情
    const contentStr = extractText(children);
    const firstBreak = contentStr.indexOf("\n");
    const hasDetail = firstBreak > 0;
    const detailText = hasDetail ? contentStr.slice(firstBreak + 1) : "";

    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="text-xs font-medium text-slate-800">
          {hasDetail ? renderFirstLine(children) : children}
        </div>
        {hasDetail && detailText && (
          <div className="mt-0.5 text-[11px] text-slate-500 whitespace-pre-wrap">
            {cleanMarkdown(detailText)}
          </div>
        )}
      </div>
    );
  },
  code({ children }) {
    const text = String(children ?? "");
    const isMultiLine = text.includes("\n");
    if (isMultiLine) {
      return (
        <pre className="my-2 overflow-auto rounded-md bg-slate-800 p-3 text-xs text-emerald-100">
          <code>{text}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-slate-200 px-1 py-0.5 text-xs font-mono text-slate-700">
        {text}
      </code>
    );
  },
};

/** 从 React children 中递归提取纯文本 */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    if (props?.children) return extractText(props.children);
  }
  return "";
}

/** 只渲染 React children 中的第一行文本（直到 \n） */
function renderFirstLine(node: React.ReactNode): React.ReactNode {
  if (typeof node === "string") {
    const idx = node.indexOf("\n");
    return idx > 0 ? node.slice(0, idx) : node;
  }
  if (Array.isArray(node)) {
    const results: React.ReactNode[] = [];
    for (const child of node) {
      if (typeof child === "string") {
        const idx = child.indexOf("\n");
        results.push(idx > 0 ? child.slice(0, idx) : child);
        if (idx > 0) break;
      } else {
        results.push(child);
        // Check if this child contains a newline
        const t = extractText(child);
        if (t.includes("\n")) break;
      }
    }
    return results;
  }
  return node;
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

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
      className="border-t border-slate-200 p-3"
    >
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-zju-primary focus:outline-none"
          placeholder="输入消息…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="rounded-md bg-zju-primary px-4 py-2 text-sm text-white hover:bg-zju-light disabled:opacity-50"
        >
          {disabled ? "发送中…" : "发送"}
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
    <div className="border-t border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 text-sm text-amber-800">
        🔔 需要确认：将执行 <span className="font-mono">{pending.toolName}</span>
      </div>
      <div className="mb-2 rounded-md bg-white/70 p-2 font-mono text-xs text-slate-600">
        {pending.summary}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm("approve")}
          disabled={pending2}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending2 ? "执行中…" : "确认执行"}
        </button>
        <button
          onClick={() => onConfirm("reject")}
          disabled={pending2}
          className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          拒绝
        </button>
      </div>
    </div>
  );
}

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  try {
    const s = JSON.stringify(input);
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
  } catch {
    return "";
  }
}

function summarizeResult(result: unknown): string {
  try {
    const s = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return s.length > 400 ? s.slice(0, 400) + "…" : s;
  } catch {
    return String(result);
  }
}
