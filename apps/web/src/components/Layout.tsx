import { type ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: "/", label: "首页", icon: "🏠", end: true },
  { to: "/courses", label: "课程", icon: "📚" },
  { to: "/assignments", label: "作业", icon: "📝" },
  { to: "/exams", label: "考试", icon: "📋" },
  { to: "/toolbox", label: "百宝箱", icon: "🧰" },
];

export function Layout({
  children,
  rightPanel,
}: {
  children: ReactNode;
  rightPanel?: ReactNode;
}) {
  const [mobileRightOpen, setMobileRightOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* === 桌面端左侧导航栏 === */}
      <aside className="hidden shrink-0 border-r border-slate-200 bg-white p-4 lg:flex lg:w-52 lg:flex-col">
        <div className="mb-6">
          <div className="text-lg font-semibold text-zju-primary">浙大校园助手</div>
          <div className="text-xs text-slate-500">ZJU Campus Agent</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-zju-primary text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {/* 底部：下载 + 设置并排 */}
        <div className="mt-auto flex gap-1">
          <NavLink
            to="/downloads"
            className={({ isActive }) =>
              `flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-zju-primary text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`
            }
          >
            <span>📁</span>
            <span>下载</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-zju-primary text-white"
                  : "text-slate-500 hover:bg-slate-100"
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
        <aside className="hidden shrink-0 border-l border-slate-200 bg-white p-4 lg:block lg:w-72 xl:w-80">
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
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${
                isActive
                  ? "text-zju-primary"
                  : "text-slate-500 hover:text-slate-700"
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        {/* 移动端设置入口 */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${
              isActive
                ? "text-zju-primary"
                : "text-slate-500 hover:text-slate-700"
            }`
          }
        >
          <span className="text-lg">⚙️</span>
          <span>设置</span>
        </NavLink>
      </nav>
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
