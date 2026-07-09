import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "AI 助手", end: true },
  { to: "/courses", label: "课程" },
  { to: "/assignments", label: "作业" },
  { to: "/classroom", label: "智云课堂" },
  { to: "/exams", label: "考试与课表" },
  { to: "/downloads", label: "下载" },
  { to: "/settings", label: "设置" },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <div className="mb-6">
          <div className="text-lg font-semibold text-zju-primary">浙大校园助手</div>
          <div className="text-xs text-slate-500">ZJU Campus Agent</div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${
                  isActive
                    ? "bg-zju-primary text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
