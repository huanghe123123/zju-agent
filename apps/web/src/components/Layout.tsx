import { type ReactNode, useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FloatingChat } from "./FloatingChat.js";
import { useFloatingChatStore } from "../stores/useFloatingChat.js";

const NAV_ITEMS: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: "/", label: "工作台", icon: "🏠", end: true },
  { to: "/courses", label: "课程表", icon: "📚" },
  { to: "/assignments", label: "待办作业", icon: "📝" },
  { to: "/exams", label: "考试安排", icon: "📋" },
];

export function Layout({
  children,
  rightPanel,
}: {
  children: ReactNode;
  rightPanel?: ReactNode;
}) {
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const { openChat } = useFloatingChatStore();

  // 全局 ⌘K / Ctrl+K 快捷唤起 AI 对话浮窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openChat]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-[#f7f8fa]">
      {/* === 桌面端左侧导航栏 === */}
      <aside className="hidden shrink-0 border-r border-slate-200/80 bg-[#fbfbfb] p-3.5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:flex-col">
        {/* Workspace Brand Header */}
        <div className="mb-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-zju-primary text-white flex items-center justify-center font-bold text-xs shadow-xs">
              求是
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 tracking-tight leading-none">浙大校园助手</div>
              <div className="text-[10px] text-slate-400 font-medium mt-1">Campus Workspace</div>
            </div>
          </div>
        </div>

        <div className="text-[11px] font-semibold text-slate-400 px-2 mb-1.5 mt-2">
          学业导航
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white text-zju-primary shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                }`
              }
            >
              <span className="text-sm">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {/* 底部：下载 + 设置并排（固定在左下角） */}
        <div className="mt-auto pt-3 border-t border-slate-100 flex gap-1.5">
          <NavLink
            to="/downloads"
            className={({ isActive }) =>
              `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-zju-primary text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`
            }
          >
            <span>📁</span>
            <span>下载</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-zju-primary text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`
            }
          >
            <span>⚙️</span>
            <span>设置</span>
          </NavLink>
        </div>
      </aside>

      {/* === 中间主内容区 === */}
      <main className="flex-1 overflow-auto px-4 py-4 pb-20 lg:pb-4 lg:px-6">
        {children}
      </main>

      {/* === 桌面端右侧辅助面板 === */}
      {rightPanel && (
        <aside className="hidden shrink-0 border-l border-slate-200 bg-white p-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto lg:w-72 xl:w-80">
          {rightPanel}
        </aside>
      )}

      {/* === 移动端：右栏可折叠面板按钮 === */}
      {rightPanel && (
        <>
          <button
            onClick={() => setMobileRightOpen((v) => !v)}
            className="fixed bottom-16 right-3 z-30 flex size-10 items-center justify-center rounded-full bg-zju-primary text-white shadow-lg lg:hidden"
          >
            {mobileRightOpen ? "✕" : "📊"}
          </button>
          {mobileRightOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div
                className="absolute inset-0 bg-black/30"
                onClick={() => setMobileRightOpen(false)}
              />
              <aside className="absolute bottom-0 right-0 top-12 w-72 overflow-auto border-l border-slate-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">辅助面板</span>
                  <button
                    onClick={() => setMobileRightOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                {rightPanel}
              </aside>
            </div>
          )}
        </>
      )}

      {/* === 移动端底栏导航 === */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-200/80 bg-white/95 backdrop-blur px-1 py-1 lg:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] rounded-lg transition-colors ${
                isActive
                  ? "text-zju-primary font-bold"
                  : "text-slate-500 hover:text-slate-700"
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        {/* 移动端下载与设置入口 */}
        <NavLink
          to="/downloads"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] rounded-lg transition-colors ${
              isActive
                ? "text-zju-primary font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`
          }
        >
          <span className="text-base">📁</span>
          <span>下载</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] rounded-lg transition-colors ${
              isActive
                ? "text-zju-primary font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`
          }
        >
          <span className="text-base">⚙️</span>
          <span>设置</span>
        </NavLink>
      </nav>

      {/* === 全局浮动 AI 对话窗口 === */}
      <FloatingChat />
    </div>
  );
}

/** 辅助面板标题+内容包装器，保持各页面右栏风格统一 */
export function RightPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-600">{title}</h3>
      {children}
    </div>
  );
}
