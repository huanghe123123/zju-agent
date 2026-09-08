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
import {
  Badge,
  Card,
  EmptyState,
  Progress,
  Segmented,
} from "@crisp-ui-kit/crisp";

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

export function DashboardPage() {
  const apiFetch = useApiFetch();
  const { data: authStatus, isLoading: authLoading } = useAuthStatus();
  const { data: rawSemesters } = useSemesters();
  const { data: courses } = useCourses();
  const { data: assignments, isLoading: assignmentsLoading } = useAllAssignments();
  const { data: exams, isLoading: examsLoading } = useExams();
  const { data: upcomingData, isLoading: scheduleLoading } = useUpcomingSchedule48h();

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
        {/* === 顶部工作台概览 (Crisp Workspace Header) === */}
        <Card raised className="p-4 sm:p-5 bg-white border border-slate-200/80">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {loggedIn && authStatus?.username
                  ? `你好，${authStatus.username} 👋`
                  : "你好，浙大学子 👋"}
              </span>
              {dateInfo && (
                <Badge tone="neutral" size="medium">
                  {dateInfo.academicYear}学年 {dateInfo.term} · {dateInfo.weekString}
                </Badge>
              )}
              {dateInfo?.isHoliday && (
                <Badge tone="warning" size="medium" dot>
                  休：{dateInfo.holidayName ?? "放假"}
                </Badge>
              )}
              {dateInfo?.isMakeupDay && (
                <Badge tone="brand" size="medium" dot>
                  调：{dateInfo.holidayName}
                </Badge>
              )}
            </div>
            <Badge tone="success" size="small" dot>
              教务已同步
            </Badge>
          </div>
        </Card>

        {/* === 第一行：接下来（按键切换：日程 / 作业） === */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>⏰</span>
                <span>接下来</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">未来 48 小时内的教学日程与临近待办</p>
            </div>

            {/* Crisp Segmented 切换器 */}
            <Segmented
              value={upcomingTab}
              onValueChange={(val) => setUpcomingTab(val as "schedule" | "assignments")}
              options={[
                {
                  value: "schedule",
                  label: (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-1">
                      <span>📅 日程</span>
                      {allPeriods.length > 0 && (
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </span>
                  ),
                },
                {
                  value: "assignments",
                  label: (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-1">
                      <span>📝 作业</span>
                      {assignments48h.length > 0 && (
                        <Badge tone="warning" size="small">
                          {assignments48h.length}
                        </Badge>
                      )}
                    </span>
                  ),
                },
              ]}
            />
          </div>

          {/* 内容网格：电脑端一排两个，手机端一排一个 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {scheduleLoading ? (
              <Card raised className="col-span-1 md:col-span-2 p-8 text-center text-xs text-slate-400">
                <span className="inline-block animate-spin mr-1.5">⏳</span>
                正在同步校历与日程时空流…
              </Card>
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
                    <Card
                      key={period.id}
                      raised
                      interactive
                      className={`p-4 flex flex-col justify-between transition-all duration-150 ${
                        isOngoing ? "border-emerald-400/80 bg-emerald-50/20 ring-1 ring-emerald-400/30" : ""
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <Badge
                            tone={isOngoing ? "success" : "brand"}
                            dot
                            size="small"
                          >
                            {isOngoing ? "正在进行" : "即将开始"}
                          </Badge>
                          <span className="text-xs font-medium text-slate-400 bg-slate-100/80 px-2 py-0.5 rounded-md">
                            {period.friendlyTimeStr}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-bold text-slate-900 truncate tracking-tight">
                              {period.title}
                            </div>
                            <div className="text-xs text-slate-600 mt-1.5 flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100/80 text-slate-700">
                                📍 {period.location}
                              </span>
                              {period.teacher && (
                                <span className="text-slate-400">· {period.teacher}</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0 bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                            <div className="text-[10px] text-slate-400 font-medium">
                              {isOngoing ? "距离下课" : "倒计时"}
                            </div>
                            <div
                              className={`text-base font-mono font-bold ${
                                isOngoing ? "text-emerald-700" : "text-zju-primary"
                              }`}
                            >
                              {formatHMS(liveSec)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {isOngoing && (
                        <div className="mt-3 pt-2 border-t border-emerald-100/60">
                          <div className="flex justify-between text-[10px] text-emerald-700 mb-1 font-medium">
                            <span>上课进度</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} />
                        </div>
                      )}
                    </Card>
                  );
                })
              ) : (
                <Card raised className="col-span-1 md:col-span-2 p-8 text-center">
                  <EmptyState
                    variant="default"
                    icon={<span className="text-3xl">🎉</span>}
                    title={
                      dateInfo?.weekString === "开学前夕" || dateInfo?.weekString === "假期"
                        ? `${dateInfo.weekString} · 48小时内暂无待办日程`
                        : "48 小时内暂无待办日程"
                    }
                    description={`${dateInfo?.academicYear ?? ""}学年 ${dateInfo?.term ?? ""}（${dateInfo?.weekString ?? "今日"}）未来 48 小时内暂无课程或考试安排。`}
                  />
                </Card>
              )
            ) : (
              /* --- 作业列表 --- */
              upcomingAssignmentsList.length > 0 ? (
                upcomingAssignmentsList.map((a) => {
                  const dueMs = a.deadline ? new Date(a.deadline).getTime() : 0;
                  const isUrgent = dueMs > 0 && dueMs - nowMs < 48 * 3600 * 1000;
                  const liveSec = dueMs > 0 ? Math.max(0, Math.floor((dueMs - nowMs) / 1000)) : 0;

                  return (
                    <Card
                      key={a.id}
                      raised
                      interactive
                      className={`p-4 flex flex-col justify-between transition-all duration-150 ${
                        isUrgent ? "border-amber-400/80 bg-amber-50/20 ring-1 ring-amber-400/30" : ""
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Badge tone="neutral" size="small">
                            <span className="truncate max-w-[180px]">{a.courseName}</span>
                          </Badge>
                          {dueMs > 0 && (
                            <Badge
                              tone={isUrgent ? "warning" : "neutral"}
                              dot={isUrgent}
                              size="small"
                            >
                              ⏳ {formatHMS(liveSec)}
                            </Badge>
                          )}
                        </div>

                        <div className="text-sm font-bold text-slate-900 line-clamp-2 mt-1">
                          {a.title}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>截止：{a.dueTimeStr}</span>
                        <Badge tone={isUrgent ? "warning" : "neutral"} size="small">
                          {isUrgent ? "48小时内紧急" : "待完成"}
                        </Badge>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <Card raised className="col-span-1 md:col-span-2 p-8 text-center">
                  <EmptyState
                    variant="default"
                    icon={<span className="text-3xl">🏖️</span>}
                    title="近 48 小时暂无紧急待交作业"
                    description="所有待办作业均在安全期内或已全部提交完毕。"
                  />
                </Card>
              )
            )}
          </div>
        </section>

        {/* === 第二行：学业快览 (KPI Metrics Tiles) === */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>📊</span>
              <span>学业快览</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">本学期核心学业统计与核心页面直达</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Link to="/courses" className="block h-full">
              <Card raised interactive className="p-4.5 h-full group transition-all duration-150 hover:-translate-y-0.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">本学期课程</span>
                    <div className="size-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-base group-hover:scale-110 transition-transform">
                      📚
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold tracking-tight text-slate-900">
                      {timetableLoading ? "…" : totalCourseCount}
                    </span>
                    <span className="text-xs font-medium text-slate-500">门课</span>
                  </div>
                </div>
                <div className="text-[11px] text-zju-primary font-semibold group-hover:underline mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span>{dateInfo?.academicYear ? `${dateInfo.term}课表` : "每周课表"}</span>
                  <span>→</span>
                </div>
              </Card>
            </Link>

            <Link to="/assignments" className="block h-full">
              <Card raised interactive className="p-4.5 h-full group transition-all duration-150 hover:-translate-y-0.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">待办作业</span>
                    <div className="size-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center text-base group-hover:scale-110 transition-transform">
                      📝
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold tracking-tight text-slate-900">
                      {assignmentsLoading ? "…" : activePending.length}
                    </span>
                    <span className="text-xs font-medium text-slate-500">项待交</span>
                    {urgentAssignments.length > 0 && (
                      <Badge tone="warning" size="small" className="ml-2">
                        {urgentAssignments.length} 临近
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-amber-600 font-semibold group-hover:underline mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span>查看截止列表</span>
                  <span>→</span>
                </div>
              </Card>
            </Link>

            <Link to="/exams" className="block h-full">
              <Card raised interactive className="p-4.5 h-full group transition-all duration-150 hover:-translate-y-0.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">考试安排</span>
                    <div className="size-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center text-base group-hover:scale-110 transition-transform">
                      📋
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold tracking-tight text-slate-900">
                      {examsLoading ? "…" : exams?.length ?? 0}
                    </span>
                    <span className="text-xs font-medium text-slate-500">场待考</span>
                  </div>
                </div>
                <div className="text-[11px] text-indigo-600 font-semibold group-hover:underline mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span>查看考场考签</span>
                  <span>→</span>
                </div>
              </Card>
            </Link>

            <Link to="/downloads" className="block h-full">
              <Card raised interactive className="p-4.5 h-full group transition-all duration-150 hover:-translate-y-0.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">下载中心</span>
                    <div className="size-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-base group-hover:scale-110 transition-transform">
                      📁
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                      本地文档
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold group-hover:underline mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span>管理课件与资料</span>
                  <span>→</span>
                </div>
              </Card>
            </Link>
          </div>
        </section>

        {/* === 第三行：百宝箱与拓展工具矩阵 === */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>🧰</span>
              <span>校园百宝箱</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              常用教务平台、校内生活与学术服务快捷直达
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {TOOLS.map((tool) => {
              const isExt = !!tool.extUrl;
              const content = (
                <Card
                  raised
                  interactive={tool.available !== false}
                  className={`p-4 h-full flex flex-col justify-between group transition-all duration-150 hover:-translate-y-0.5 ${
                    tool.available === false ? "opacity-75" : ""
                  }`}
                >
                  <div>
                    <div className="size-10 rounded-xl bg-slate-100/90 text-xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-blue-50 transition-all">
                      {tool.icon}
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm text-slate-900 group-hover:text-zju-primary transition-colors">
                        {tool.title}
                      </h3>
                      {tool.available === false && (
                        <Badge tone="neutral" size="small">
                          即将推出
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>

                  {tool.available !== false && (
                    <div className="mt-3.5 pt-2 border-t border-slate-100 text-[11px] font-semibold text-zju-primary flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
                      <span>{isExt ? "访问校内服务" : "进入功能"}</span>
                      <span>{isExt ? "↗" : "→"}</span>
                    </div>
                  )}
                </Card>
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
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>⚙️</span>
              <span>系统与连接状态</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">账号认证凭据与推理大模型连接检测</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. 浙大统一身份认证状态 */}
            <Card raised className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">统一身份认证 (ZJU)</span>
                  <Badge
                    tone={authLoading ? "neutral" : loggedIn ? "success" : "warning"}
                    dot
                    size="small"
                  >
                    {authLoading ? "检测中…" : loggedIn ? "已登录" : "未登录"}
                  </Badge>
                </div>
                <div className="font-semibold text-sm text-slate-900 truncate">
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
            </Card>

            {/* 2. AI 模型 API 接口状态 */}
            <Card raised className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">大模型 API 接口</span>
                  <Badge
                    tone={settingsLoading ? "neutral" : hasModelConfigured ? "success" : "danger"}
                    dot
                    size="small"
                  >
                    {settingsLoading ? "检测中…" : hasModelConfigured ? "已就绪" : "未配置"}
                  </Badge>
                </div>
                <div className="font-semibold text-sm text-slate-900 truncate">
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
            </Card>
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
