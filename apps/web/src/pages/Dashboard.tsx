import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "../components/Layout.js";
import { useAuthStatus } from "../api/auth.js";
import { useApiFetch } from "../api/bootstrap.js";
import {
  useCourses,
  useSemesters,
  useAllAssignments,
  useExams,
  useTimetable,
  useUpcomingSchedule48h,
} from "../api/zju.js";
import { useFloatingChatStore } from "../stores/useFloatingChat.js";

/** 学在浙大学期名 → 教务网 xnxq01id */
function semesterToXnxq01id(name: string): string | null {
  const m = /^(\d{4}-\d{4})(春|夏|春夏|秋|冬|秋冬|短|短学期)$/.exec(name);
  if (!m) return null;
  const term = m[2]!;
  const year = m[1]!;
  if (term === "短" || term === "短学期") return `${year}-3`;
  return `${year}-${["春", "夏", "春夏"].includes(term) ? "2" : "1"}`;
}

interface ToolItem {
  title: string;
  description: string;
  icon: string;
  category: "study" | "life";
  to?: string;
  extUrl?: string;
  available?: boolean;
}

const TOOLS: ToolItem[] = [
  {
    title: "智云课堂",
    description: "课堂回放、课件下载与语音转文字检索",
    icon: "🎓",
    category: "study",
    to: "/classroom",
    extUrl: "https://classroom.zju.edu.cn",
    available: true,
  },
  {
    title: "学在浙大",
    description: "Canvas 平台、在线作业提交与教学通知",
    icon: "📖",
    category: "study",
    extUrl: "https://courses.zju.edu.cn",
    available: true,
  },
  {
    title: "本科生教务系统",
    description: "选课系统、培养方案、成绩单与考签查询",
    icon: "🏛️",
    category: "study",
    extUrl: "http://jwbinfosys.zju.edu.cn",
    available: true,
  },
  {
    title: "CC98 论坛",
    description: "浙大学子专属的校内交流社区与论坛天地",
    icon: "💬",
    category: "life",
    extUrl: "https://www.cc98.org",
    available: true,
  },
  {
    title: "校网充值与查询",
    description: "查询校网账户状态、剩余流量与快速充值",
    icon: "💳",
    category: "life",
    extUrl: "https://myvpn.zju.edu.cn",
    available: true,
  },
  {
    title: "图书馆座位预约",
    description: "各校区图书馆自习室座位与研修间实时预约",
    icon: "📚",
    category: "life",
    extUrl: "http://libsys.zju.edu.cn",
    available: true,
  },
  {
    title: "校务综合服务大厅",
    description: "校车时刻表、学籍异动、用印申请与事务办理",
    icon: "🏢",
    category: "life",
    extUrl: "https://service.zju.edu.cn",
    available: true,
  },
  {
    title: "ETA 成绩分析",
    description: "专业排名、成绩与 GPA 换算分析",
    icon: "📊",
    category: "study",
    available: false,
  },
];

const AI_SHORTCUTS = [
  { label: "📅 今天有什么课？", prompt: "今天有什么课？请列出上课时间和地点。" },
  { label: "📝 最近有什么作业要交？", prompt: "最近有什么作业要交？请按截止时间排序。" },
  { label: "📋 查一下这学期的考试安排", prompt: "查一下这学期的考试安排和考场地点。" },
  { label: "📚 总结本学期所有课程", prompt: "总结一下我本学期的所有课程和学分情况。" },
  { label: "💳 如何查询和充值校网？", prompt: "告诉我如何查询校网状态和充值校网。" },
];

export function DashboardPage() {
  const apiFetch = useApiFetch();
  const { data: authStatus, isLoading: authLoading } = useAuthStatus();
  const { data: rawSemesters } = useSemesters();
  const { data: courses } = useCourses();
  const { data: assignments, isLoading: assignmentsLoading } = useAllAssignments();
  const { data: exams, isLoading: examsLoading } = useExams();
  const { data: upcomingData, isLoading: scheduleLoading } = useUpcomingSchedule48h();
  const { openChat } = useFloatingChatStore();

  const loggedIn = authStatus?.ok ?? false;
  const dateInfo = upcomingData?.dateInfo;

  // 获取模型设置状态
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

  // 倒计时刷新
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 筛选【本学期课程】
  const semesterMap = useMemo(
    () => new Map((rawSemesters ?? []).map((s) => [s.id, s])),
    [rawSemesters],
  );

  const currentSemesterId = dateInfo?.semesterId ?? "2026-2027-1";
  const { data: timetableEntries, isLoading: timetableLoading } = useTimetable(currentSemesterId);

  const timetableCourseCount = useMemo(() => {
    if (!timetableEntries || timetableEntries.length === 0) return 0;
    return new Set(timetableEntries.map((t) => t.courseName)).size;
  }, [timetableEntries]);

  const currentSemesterCourses = useMemo(() => {
    if (!courses) return [];
    return courses.filter((c) => {
      const sem = semesterMap.get(c.semesterId);
      if (!sem) return false;
      return semesterToXnxq01id(sem.name) === currentSemesterId;
    });
  }, [courses, semesterMap, currentSemesterId]);

  const totalCourseCount = timetableCourseCount > 0 ? timetableCourseCount : currentSemesterCourses.length;

  // 统计计算
  const activePending = (assignments ?? []).filter(
    (a) => !a.submitted && (!a.deadline || Date.parse(a.deadline) > nowMs),
  );
  const urgentAssignments = (assignments ?? []).filter((a) => {
    if (a.submitted || !a.deadline) return false;
    const due = Date.parse(a.deadline);
    return due > nowMs && due - nowMs < 48 * 3600 * 1000;
  });

  const assignments48h = upcomingData?.assignments48h ?? [];

  const [upcomingTab, setUpcomingTab] = useState<"schedule" | "assignments">("schedule");

  const allPeriods = useMemo(() => {
    if (upcomingData?.allPeriods && upcomingData.allPeriods.length > 0) {
      return upcomingData.allPeriods;
    }
    if (upcomingData?.activePeriod) {
      return [upcomingData.activePeriod, ...(upcomingData.laterPeriods ?? [])];
    }
    return [];
  }, [upcomingData]);

  const upcomingAssignmentsList = useMemo(() => {
    if (assignments48h && assignments48h.length > 0) return assignments48h;
    return (assignments ?? [])
      .filter((a) => !a.submitted && (!a.deadline || Date.parse(a.deadline) > nowMs))
      .slice(0, 4)
      .map((a) => ({
        id: a.id,
        title: a.title,
        courseId: a.courseId,
        courseName: a.courseName,
        deadline: a.deadline ?? "",
        deadlineIso: a.deadline ? new Date(a.deadline).toISOString() : "",
        dueTimeStr: a.deadline
          ? new Date(a.deadline).toLocaleDateString("zh-CN", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) + " 截止"
          : "无截止时间",
        remainingSeconds: a.deadline
          ? Math.max(0, Math.floor((Date.parse(a.deadline) - nowMs) / 1000))
          : 0,
      }));
  }, [assignments48h, assignments, nowMs]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* === 顶部欢迎条 === */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-zju-primary p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 size-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-bold tracking-tight">
                  {loggedIn && authStatus?.username
                    ? `你好，${authStatus.username} 👋`
                    : "你好，浙大学子 👋"}
                </span>
                {dateInfo && (
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                    {dateInfo.academicYear}学年 {dateInfo.term} · {dateInfo.weekString}
                  </span>
                )}
                {dateInfo?.isHoliday && (
                  <span className="rounded-full bg-amber-400 text-amber-950 px-2 py-0.5 text-xs font-bold">
                    休：{dateInfo.holidayName ?? "放假"}
                  </span>
                )}
                {dateInfo?.isMakeupDay && (
                  <span className="rounded-full bg-purple-300 text-purple-950 px-2 py-0.5 text-xs font-bold">
                    调：{dateInfo.holidayName}
                  </span>
                )}
              </div>
              <p className="text-blue-100 text-xs sm:text-sm max-w-xl">
                欢迎来到浙大校园助手。已聚合本学期课程、48小时日程时空流与百宝箱工具，随时可向右下角 AI 助手提问。
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2.5">
              <button
                onClick={() => openChat()}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-zju-primary shadow-sm hover:bg-blue-50 active:scale-95 transition cursor-pointer"
              >
                <span className="text-base">💬</span>
                <span>呼叫 AI 助手</span>
              </button>
            </div>
          </div>
        </div>

        {/* === 第一行：接下来（按键切换：日程 / 作业） === */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <span>⏰</span>
              <span>接下来</span>
            </h2>

            {/* 日程 / 作业 切换器 */}
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200/60">
              <button
                type="button"
                onClick={() => setUpcomingTab("schedule")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition cursor-pointer ${
                  upcomingTab === "schedule"
                    ? "bg-white text-zju-primary shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
              >
                <span>📅 日程</span>
                {allPeriods.length > 0 && (
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setUpcomingTab("assignments")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition cursor-pointer ${
                  upcomingTab === "assignments"
                    ? "bg-white text-zju-primary shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
              >
                <span>📝 作业</span>
                {assignments48h.length > 0 && (
                  <span className="rounded-full bg-amber-200/80 text-amber-900 px-1.5 py-0.2 text-[10px] font-bold">
                    {assignments48h.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 内容网格：电脑端一排两个，手机端一排一个 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {scheduleLoading ? (
              <div className="col-span-1 md:col-span-2 rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                <span className="inline-block animate-spin mr-1.5">⏳</span>
                正在同步校历与日程时空流…
              </div>
            ) : upcomingTab === "schedule" ? (
              /* --- 日程列表 --- */
              allPeriods.length > 0 ? (
                allPeriods.map((period) => {
                  const startMs = new Date(period.startIso).getTime();
                  const endMs = new Date(period.endIso).getTime();
                  const isOngoing = startMs <= nowMs && nowMs < endMs;
                  const liveSec = isOngoing
                    ? Math.max(0, Math.floor((endMs - nowMs) / 1000))
                    : Math.max(0, Math.floor((startMs - nowMs) / 1000));
                  const totalDur = Math.max(1, endMs - startMs);
                  const progress = isOngoing
                    ? Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / totalDur) * 100)))
                    : 0;

                  return (
                    <div
                      key={period.id}
                      className={`rounded-xl border p-4 shadow-2xs flex flex-col justify-between transition ${
                        isOngoing
                          ? "border-emerald-200 bg-emerald-50/40"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                              isOngoing ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                isOngoing ? "bg-emerald-500 animate-pulse" : "bg-blue-500"
                              }`}
                            />
                            {isOngoing ? "正在进行" : "即将开始"}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {period.friendlyTimeStr}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-bold text-slate-900 truncate">
                              {period.title}
                            </div>
                            <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                              <span>📍 {period.location}</span>
                              {period.teacher && (
                                <span className="text-slate-400">· {period.teacher}</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-[10px] text-slate-400 font-medium">
                              {isOngoing ? "距离下课" : "倒计时"}
                            </div>
                            <div
                              className={`text-lg font-mono font-bold ${
                                isOngoing ? "text-emerald-700" : "text-zju-primary"
                              }`}
                            >
                              {formatHMS(liveSec)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {isOngoing && (
                        <div className="h-1.5 w-full rounded-full bg-emerald-200/60 overflow-hidden mt-3">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-1 md:col-span-2 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/40 via-indigo-50/20 to-white p-6 text-center space-y-2">
                  <div className="text-3xl">🎉</div>
                  <div className="text-sm font-bold text-slate-800">
                    {dateInfo?.weekString === "开学前夕" || dateInfo?.weekString === "假期"
                      ? `${dateInfo.weekString} · 48小时内暂无待办日程`
                      : "48 小时内暂无待办日程"}
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {dateInfo?.academicYear}学年 {dateInfo?.term}（{dateInfo?.weekString ?? "今日"}）未来 48 小时内暂无课程或考试安排。
                  </p>
                </div>
              )
            ) : (
              /* --- 作业列表 --- */
              upcomingAssignmentsList.length > 0 ? (
                upcomingAssignmentsList.map((a) => {
                  const dueMs = a.deadline ? new Date(a.deadline).getTime() : 0;
                  const isUrgent = dueMs > 0 && dueMs - nowMs < 48 * 3600 * 1000;
                  const liveSec = dueMs > 0 ? Math.max(0, Math.floor((dueMs - nowMs) / 1000)) : 0;

                  return (
                    <div
                      key={a.id}
                      className={`rounded-xl border p-4 shadow-2xs flex flex-col justify-between transition ${
                        isUrgent ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 font-medium truncate max-w-[180px]">
                            {a.courseName}
                          </span>
                          {dueMs > 0 && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono font-bold ${
                                isUrgent ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              ⏳ {formatHMS(liveSec)}
                            </span>
                          )}
                        </div>

                        <div className="text-sm font-bold text-slate-900 line-clamp-2 mt-1">
                          {a.title}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                        <span>截止：{a.dueTimeStr}</span>
                        {isUrgent ? (
                          <span className="text-amber-600 font-semibold text-[11px]">48小时内紧急</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">待完成</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-1 md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-center space-y-2">
                  <div className="text-3xl">🏖️</div>
                  <div className="text-sm font-bold text-slate-700">近 48 小时暂无紧急待交作业</div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    所有待办作业均在安全期内或已全部提交完毕。
                  </p>
                </div>
              )
            )}
          </div>
        </section>

        {/* === 第二行：学业快览 === */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <span>📊</span>
            <span>学业快览</span>
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              to="/courses"
              className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-zju-primary hover:shadow-xs transition"
            >
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform origin-left">📚</div>
              <div className="text-xs text-slate-500">本学期课程</div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                {timetableLoading ? "…" : `${totalCourseCount} 门`}
              </div>
              <div className="text-[11px] text-zju-primary group-hover:underline mt-1">
                {dateInfo?.academicYear
                  ? `${dateInfo.academicYear} ${dateInfo.term}课表 →`
                  : "查看每周课表 →"}
              </div>
            </Link>

            <Link
              to="/assignments"
              className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-400 hover:shadow-xs transition"
            >
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform origin-left">📝</div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">待办作业</span>
                {urgentAssignments.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                    {urgentAssignments.length} 临近
                  </span>
                )}
              </div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                {assignmentsLoading ? "…" : `${activePending.length} 项待交`}
              </div>
              <div className="text-[11px] text-amber-600 group-hover:underline mt-1">
                查看作业截止 →
              </div>
            </Link>

            <Link
              to="/exams"
              className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-400 hover:shadow-xs transition"
            >
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform origin-left">📋</div>
              <div className="text-xs text-slate-500">考试安排</div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                {examsLoading ? "…" : `${exams?.length ?? 0} 场`}
              </div>
              <div className="text-[11px] text-indigo-600 group-hover:underline mt-1">
                查看考场考签 →
              </div>
            </Link>

            <Link
              to="/downloads"
              className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-400 hover:shadow-xs transition"
            >
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform origin-left">📁</div>
              <div className="text-xs text-slate-500">下载中心</div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">本地文档</div>
              <div className="text-[11px] text-emerald-600 group-hover:underline mt-1">
                管理已存文件 →
              </div>
            </Link>
          </div>
        </section>

        {/* === 百宝箱与拓展工具矩阵 === */}
        <section className="space-y-4 pt-2">
          <div>
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <span>🧰</span>
              <span>校园百宝箱</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              常用教务平台、校内生活与学术服务快捷直达
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TOOLS.map((tool) => {
              const isExt = !!tool.extUrl;
              const content = (
                <div
                  className={`h-full rounded-xl border p-4 shadow-2xs flex flex-col justify-between transition ${
                    tool.available !== false
                      ? "border-slate-200 bg-white hover:border-zju-primary hover:shadow-xs group cursor-pointer"
                      : "border-dashed border-slate-200 bg-slate-50/60 opacity-80"
                  }`}
                >
                  <div>
                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">
                      {tool.icon}
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm text-slate-800 group-hover:text-zju-primary transition-colors">
                        {tool.title}
                      </h3>
                      {tool.available === false && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] text-slate-500">
                          即将推出
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>

                  {tool.available !== false && (
                    <div className="mt-3 pt-2 text-[11px] font-semibold text-zju-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>{isExt ? "访问校内服务 ↗" : "进入功能 →"}</span>
                    </div>
                  )}
                </div>
              );

              if (tool.extUrl) {
                return (
                  <a
                    key={tool.title}
                    href={tool.extUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-full"
                    title={`打开 ${tool.title}`}
                  >
                    {content}
                  </a>
                );
              }

              if (tool.to) {
                return (
                  <Link key={tool.title} to={tool.to} className="block h-full">
                    {content}
                  </Link>
                );
              }

              return (
                <div key={tool.title} className="block h-full">
                  {content}
                </div>
              );
            })}
          </div>
        </section>

        {/* === 第四行：系统与连接状态 === */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <span>⚙️</span>
            <span>系统与连接状态</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. 浙大统一身份认证状态 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">统一身份认证 (ZJU)</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      authLoading
                        ? "bg-slate-100 text-slate-600"
                        : loggedIn
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                        : "bg-amber-50 text-amber-700 border border-amber-200/60"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        authLoading ? "bg-slate-400" : loggedIn ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {authLoading ? "检测中…" : loggedIn ? "已登录" : "未登录"}
                  </span>
                </div>
                <div className="font-semibold text-sm text-slate-800 truncate">
                  {loggedIn
                    ? `账号：${authStatus?.username ?? "已认证"}`
                    : "尚未绑定学号密码"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {loggedIn
                    ? "已连接学在浙大、教学教务与考场系统"
                    : "绑定后即可一键拉取课表、同步作业与考签"}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <Link
                  to={loggedIn ? "/settings#zju" : "/setup"}
                  className="text-xs font-semibold text-zju-primary hover:underline flex items-center justify-between"
                >
                  <span>{loggedIn ? "管理认证凭据" : "立即绑定账号"}</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            {/* 2. AI 模型 API 接口状态 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">大模型 API 接口</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      settingsLoading
                        ? "bg-slate-100 text-slate-600"
                        : hasModelConfigured
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                        : "bg-rose-50 text-rose-700 border border-rose-200/60"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        settingsLoading ? "bg-slate-400" : hasModelConfigured ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    {settingsLoading ? "检测中…" : hasModelConfigured ? "已就绪" : "未配置"}
                  </span>
                </div>
                <div className="font-semibold text-sm text-slate-800 truncate">
                  {hasModelConfigured
                    ? `${activeProvider?.name ?? settingsData?.credentials?.modelProviderName ?? "大模型服务"}`
                    : "暂无可用模型配置"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  {hasModelConfigured
                    ? `模型：${activeProvider?.model || "已连接到推理服务端"}`
                    : "配置 API Key 后即可开启全自动工具调用与对话"}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <Link
                  to="/settings#providers"
                  className="text-xs font-semibold text-zju-primary hover:underline flex items-center justify-between"
                >
                  <span>{hasModelConfigured ? "切换提供商与模型" : "前往配置 API Key"}</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* === 常用提问与 AI 对话快捷助手 === */}
        <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-blue-50/40 to-white p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">💡</span>
              <h3 className="text-sm font-bold text-slate-800">快捷向 AI 校园助手提问</h3>
            </div>
            <button
              onClick={() => openChat()}
              className="text-xs font-semibold text-zju-primary hover:underline cursor-pointer"
            >
              展开浮窗 →
            </button>
          </div>
          <p className="text-xs text-slate-500">
            点击以下常用预设问题，将直接唤起右下角智能浮窗并填入对应问题：
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {AI_SHORTCUTS.map((item) => (
              <button
                key={item.label}
                onClick={() => openChat(undefined, item.prompt)}
                className="rounded-xl border border-indigo-200/80 bg-white px-3 py-2 text-xs text-slate-700 hover:border-zju-primary hover:text-zju-primary hover:shadow-2xs active:scale-95 transition cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}

function formatHMS(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
