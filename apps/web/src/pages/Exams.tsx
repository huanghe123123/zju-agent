import { Layout } from "../components/Layout.js";
import { ErrorState } from "../components/ErrorState.js";
import { Loading } from "../components/Loading.js";
import {
  useSemesters,
  useExams,
  useTimetable,
} from "../api/zju.js";
import { formatDateTime, deadlineUrgency, urgencyClass } from "../utils/format.js";
import type { Exam, TimetableEntry, Semester } from "@zju-agent/core";
import { useMemo, useState } from "react";

/** 学在浙大学期名 → 教务网 xnxq01id（与后端 semesterToXnxq01id 对齐，供前端选学期用） */
function semesterToXnxq01id(name: string): string | null {
  const m = /^(\d{4}-\d{4})(春|夏|春夏|秋|冬|秋冬|短)$/.exec(name);
  if (!m) return null;
  const year = m[1]!;
  const term = m[2]!;
  const id = ["春", "夏", "春夏"].includes(term) ? "2" : "1";
  return `${year}-${id}`;
}

/** 合并子学期（春/夏→春夏），返回按最近在前排序的去重列表 */
function mergedSemesters(semesters: Semester[]): Semester[] {
  const byId = new Map<string, Semester>();
  for (const s of semesters) {
    const id = semesterToXnxq01id(s.name);
    if (!id) continue;
    const existing = byId.get(id);
    // 保留 isActive 任一为真
    if (!existing || (s.isActive && !existing.isActive)) {
      byId.set(id, {
        ...s,
        name:
          id.endsWith("-1")
            ? `${id.slice(0, 9)}秋冬`
            : id.endsWith("-2")
              ? `${id.slice(0, 9)}春夏`
              : s.name,
      });
    }
  }
  return [...byId.values()].sort((a, b) => {
    const ax = semesterToXnxq01id(a.name)!;
    const bx = semesterToXnxq01id(b.name)!;
    return bx.localeCompare(ax);
  });
}

export function ExamsPage() {
  const [tab, setTab] = useState<"exams" | "timetable">("exams");
  const { data: rawSemesters } = useSemesters();
  const semesters = useMemo(() => mergedSemesters(rawSemesters ?? []), [rawSemesters]);

  // 默认学期：活跃 → 最近一次（列表第一项）
  const defaultId = useMemo(() => {
    const active = semesters.find((s) => s.isActive);
    if (active) return semesterToXnxq01id(active.name)!;
    return semesters[0] ? semesterToXnxq01id(semesters[0].name)! : undefined;
  }, [semesters]);

  const [selected, setSelected] = useState<string | undefined>(undefined);
  const xnxq01id = selected ?? defaultId;

  return (
    <Layout>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold text-zju-primary">考试与课表</h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
          <TabBtn active={tab === "exams"} onClick={() => setTab("exams")}>考试安排</TabBtn>
          <TabBtn active={tab === "timetable"} onClick={() => setTab("timetable")}>课程表</TabBtn>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>学期</span>
          <select
            value={xnxq01id ?? ""}
            onChange={(e) => setSelected(e.target.value || undefined)}
            disabled={semesters.length === 0}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-zju-primary focus:outline-none disabled:opacity-50"
          >
            {semesters.length === 0 && <option value="">（暂无学期）</option>}
            {semesters.map((s) => {
              const id = semesterToXnxq01id(s.name)!;
              return (
                <option key={id} value={id}>
                  {s.name}{s.isActive ? " · 本学期" : ""}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {!xnxq01id ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          未识别到任何学期，请先在学在浙大确认已选课。
        </div>
      ) : tab === "exams" ? (
        <ExamsPanel xnxq01id={xnxq01id} />
      ) : (
        <TimetablePanel xnxq01id={xnxq01id} />
      )}
    </Layout>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 whitespace-nowrap rounded px-3 py-1.5 text-sm ${active ? "bg-zju-primary text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}

function ExamsPanel({ xnxq01id }: { xnxq01id: string }) {
  const { data, isLoading, error, refetch, isFetching } = useExams(xnxq01id);
  const exams = data ?? [];
  const upcoming = exams.filter((e) => e.time && Date.parse(e.time) >= Date.now());
  const past = exams.filter((e) => e.time && Date.parse(e.time) < Date.now());
  const noTime = exams.filter((e) => !e.time);

  if (error) {
    return (
      <>
        <ErrorState message={error.message} hint="请确认 ZJU 账号已验证，且教务网可访问。" />
        <button onClick={() => refetch()} className="mt-3 text-sm text-zju-primary">重试</button>
      </>
    );
  }
  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => refetch()} disabled={isFetching} className="text-sm text-slate-500 hover:text-zju-primary disabled:opacity-50">
          {isFetching ? "刷新中…" : "刷新"}
        </button>
      </div>

      <Section title="即将到来的考试" exams={upcoming} emptyText="近期无考试安排 🎉" />
      {past.length > 0 && <Section title="已结束" exams={past} emptyText="" />}
      {noTime.length > 0 && (
        <Section title="待安排时间" exams={noTime} emptyText="" />
      )}

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        提醒规则（默认）：考试前 1 天、2 小时、30 分钟各提醒一次。可在设置中调整或关闭。
      </div>
    </div>
  );
}

function Section({ title, exams, emptyText }: { title: string; exams: Exam[]; emptyText: string }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-600">{title}（{exams.length}）</h2>
      {exams.length === 0 ? (
        emptyText ? <div className="text-xs text-slate-400">{emptyText}</div> : null
      ) : (
        <ul className="space-y-2">
          {exams.map((e) => (
            <ExamItem key={e.id} exam={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ExamItem({ exam }: { exam: Exam }) {
  const urgency = deadlineUrgency(exam.time);
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-800">{exam.courseName}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {exam.semester ? `学期 ${exam.semester}` : ""}
          </div>
        </div>
        {urgency !== "none" && (
          <span className={`shrink-0 text-xs ${urgencyClass(urgency)}`}>
            {urgency === "overdue" ? "已结束" : "即将考试"}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
        <div>
          <div className="text-slate-400">时间</div>
          <div>{formatDateTime(exam.time)}</div>
        </div>
        <div>
          <div className="text-slate-400">地点</div>
          <div className="truncate">{exam.location || "—"}</div>
        </div>
        <div>
          <div className="text-slate-400">座位</div>
          <div>{exam.seat || "—"}</div>
        </div>
      </div>
    </li>
  );
}

function TimetablePanel({ xnxq01id }: { xnxq01id: string }) {
  const { data, isLoading, error, refetch, isFetching } = useTimetable(xnxq01id);
  const entries = data ?? [];

  if (error) {
    return (
      <>
        <ErrorState message={error.message} hint="教务网课表接口可能调整，正在尝试兼容解析。" />
        <button onClick={() => refetch()} className="mt-3 text-sm text-zju-primary">重试</button>
      </>
    );
  }
  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => refetch()} disabled={isFetching} className="text-sm text-slate-500 hover:text-zju-primary disabled:opacity-50">
          {isFetching ? "刷新中…" : "刷新"}
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          该学期暂无课表数据
        </div>
      ) : (
        <TimetableGrid entries={entries} />
      )}
    </div>
  );
}

/** CSS Grid 周课表：横轴星期 1-7（周一~周日），纵轴 1-13 节，每个课程占据对应的格子 */
function TimetableGrid({ entries }: { entries: TimetableEntry[] }) {
  const DAY_LABELS = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const MAX_SECTION = 13;
  const DAYS = [1, 2, 3, 4, 5, 6, 7];

  // 给不同课程分配颜色（按课程名去重后轮询）
  const COURSE_COLORS = [
    "bg-blue-50 border-blue-200 text-blue-800",
    "bg-pink-50 border-pink-200 text-pink-800",
    "bg-emerald-50 border-emerald-200 text-emerald-800",
    "bg-amber-50 border-amber-200 text-amber-800",
    "bg-purple-50 border-purple-200 text-purple-800",
    "bg-rose-50 border-rose-200 text-rose-800",
    "bg-cyan-50 border-cyan-200 text-cyan-800",
    "bg-indigo-50 border-indigo-200 text-indigo-800",
  ];
  const courseNames = [...new Set(entries.map((e) => e.courseName))];
  const colorOf = (name: string) => COURSE_COLORS[courseNames.indexOf(name) % COURSE_COLORS.length];

  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `48px repeat(7, minmax(100px, 1fr))`,
          minWidth: 750,
        }}
      >
        {/* 表头：节次 + 周一~周日 */}
        <div className="sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-50 p-1.5 text-center text-[11px] font-medium text-slate-500">
          节次
        </div>
        {DAYS.map((d) => (
          <div
            key={`h-${d}`}
            className="sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-50 p-1.5 text-center text-[11px] font-medium text-slate-500"
          >
            {DAY_LABELS[d]}
          </div>
        ))}

        {/* 行：每节课一行的网格背景 */}
        {Array.from({ length: MAX_SECTION }, (_, i) => {
          const sec = i + 1;
          return (
            <div key={`row-${sec}`} className="contents">
              <div className="border-b border-r border-slate-100 bg-slate-50/50 p-1 text-center text-[10px] text-slate-400">
                {sec}
              </div>
              {DAYS.map((d) => (
                <div
                  key={`bg-${d}-${sec}`}
                  className="border-b border-r border-slate-100 bg-white"
                  style={{ minHeight: 48 }}
                />
              ))}
            </div>
          );
        })}

        {/* 课程卡片：定位到对应的 星期×节次 格子 */}
        {entries.map((e) => (
          <div
            key={e.id}
            className={`m-0.5 overflow-hidden rounded border p-1.5 text-xs ${colorOf(e.courseName)}`}
            style={{
              gridColumn: e.weekday + 1, // 第 1 列是节次标签
              gridRow: `${e.startSection + 1} / ${e.endSection + 2}`, // 第 1 行是表头
            }}
          >
            <div className="truncate font-medium">{e.courseName}</div>
            {e.teacher && <div className="truncate text-[10px] opacity-70">{e.teacher}</div>}
            {e.location && <div className="truncate text-[10px] opacity-70">{e.location}</div>}
            {e.weeks.length > 0 && (
              <div className="mt-0.5 text-[10px] opacity-50">{compressWeeks(e.weeks)} 周</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 压缩周次数组为可读字符串，如 [1,2,3,5,6] → "1-3,5-6" */
function compressWeeks(weeks: number[]): string {
  if (weeks.length === 0) return "";
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0]!;
  let prev = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    if (cur !== prev + 1) {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = cur;
    }
    prev = cur;
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(",");
}
