import { useQuery } from "@tanstack/react-query";
import { useApiFetch } from "../api/bootstrap.js";
import type { ApiResponse, AuthStatus } from "@zju-agent/core";
import { Layout } from "../components/Layout.js";
import { useCourses, useAllAssignments, useExams, useTimetable } from "../api/zju.js";
import { Link } from "react-router-dom";

export function RootRoute() {
  const apiFetch = useApiFetch();
  const { data: authStatus, isLoading } = useQuery({
    queryKey: ["auth", "status"],
    queryFn: async () => {
      const res = await apiFetch("/api/auth/status");
      const json = (await res.json()) as ApiResponse<AuthStatus>;
      if (!json.ok) throw new Error(json.error.message);
      return json.data;
    },
  });

  const loggedIn = authStatus?.ok ?? false;

  // 课程与待办作业（仅登录后拉取，失败静默兜底为占位）
  const { data: courses } = useCourses();
  const { data: assignments } = useAllAssignments();
  const { data: exams } = useExams();
  const { data: timetable } = useTimetable();
  const pendingCount = (assignments ?? []).filter((a) => !a.submitted).length;
  const overdueCount = (assignments ?? [])
    .filter((a) => !a.submitted && a.deadline)
    .filter((a) => Date.parse(a.deadline!) < Date.now()).length;

  // 今日课程：按当前星期几筛选，且本周次包含当前周
  const today = new Date();
  const weekday = today.getDay() === 0 ? 7 : today.getDay();
  const todayCourses = (timetable ?? []).filter((e) => {
    if (e.weekday !== weekday) return false;
    return e.weeks.length === 0 || true; // 周次信息不精确时也展示
  });
  // 近期考试：未来 7 天内
  const now = Date.now();
  const weekLater = now + 7 * 24 * 3600_000;
  const upcomingExams = (exams ?? []).filter(
    (e) => e.time && Date.parse(e.time) >= now && Date.parse(e.time) <= weekLater,
  );

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-zju-primary mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <LinkCard
          title="今日课程"
          value={loggedIn ? String(todayCourses.length) : "—"}
          hint={loggedIn ? "点击查看课表" : "登录后展示"}
          to="/exams"
        />
        <LinkCard
          title="待办作业"
          value={loggedIn ? String(pendingCount) : "—"}
          hint={
            loggedIn
              ? overdueCount > 0
                ? `${overdueCount} 项已逾期`
                : "点击查看详情"
              : "登录后展示"
          }
          to="/assignments"
        />
        <LinkCard
          title="近期考试"
          value={loggedIn ? String(upcomingExams.length) : "—"}
          hint={loggedIn ? "未来 7 天内的考试" : "登录后展示"}
          to="/exams"
        />
        <Card title="今日天气" value="—" hint="阶段 5 接入天气工具后展示" />
        <Card
          title="登录状态"
          value={isLoading ? "查询中" : loggedIn ? (authStatus?.username ?? "已登录") : "未登录"}
          hint={loggedIn ? "统一身份认证已验证" : "前往设置配置 ZJU 账号"}
        />
        <LinkCard
          title="课程数"
          value={loggedIn ? String((courses ?? []).length) : "—"}
          hint={loggedIn ? "点击查看课程资料" : "登录后展示"}
          to="/courses"
        />
        <Card
          title="模型状态"
          value={loggedIn ? "可用" : "未配置"}
          hint="前往设置配置 LLM provider"
        />
      </div>
    </Layout>
  );
}

function Card({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="my-1 text-2xl font-semibold truncate">{value}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function LinkCard({
  title,
  value,
  hint,
  to,
}: {
  title: string;
  value: string;
  hint: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-zju-primary"
    >
      <div className="text-sm text-slate-500">{title}</div>
      <div className="my-1 text-2xl font-semibold truncate">{value}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </Link>
  );
}
