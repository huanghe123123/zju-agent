import { useState, useMemo } from "react";
import { Layout, RightPanel } from "../components/Layout.js";
import { ErrorState } from "../components/ErrorState.js";
import { Loading } from "../components/Loading.js";
import { TimetableGrid } from "../components/TimetableGrid.js";
import {
  useCourses,
  useSemesters,
  useMaterials,
  useDownloadMaterial,
  useTimetable,
} from "../api/zju.js";
import { formatBytes } from "../utils/format.js";
import type { Course, Semester } from "@zju-agent/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays, faLightbulb, faXmark } from "@fortawesome/free-solid-svg-icons";

/** 学在浙大学期名 → 教务网 xnxq01id */
function semesterToXnxq01id(name: string): string | null {
  const m = /^(\d{4}-\d{4})(春|夏|春夏|秋|冬|秋冬|短|短学期)$/.exec(name);
  if (!m) return null;
  const term = m[2]!;
  const year = m[1]!;
  if (term === "短" || term === "短学期") return `${year}-3`;
  return `${year}-${["春", "夏", "春夏"].includes(term) ? "2" : "1"}`;
}

/** 合并子学期，按最近在前排序 */
function mergedSemesters(semesters: Semester[]): Semester[] {
  const byId = new Map<string, Semester>();
  for (const s of semesters) {
    const id = semesterToXnxq01id(s.name);
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      let displayName = `${id.slice(0, 9)}秋冬`;
      if (id.endsWith("-2")) displayName = `${id.slice(0, 9)}春夏`;
      else if (id.endsWith("-3")) displayName = `${id.slice(0, 9)}短学期`;
      byId.set(id, { ...s, name: displayName });
    }
  }
  return [...byId.values()].sort((a, b) => {
    const ax = semesterToXnxq01id(a.name) || "";
    const bx = semesterToXnxq01id(b.name) || "";
    return bx.localeCompare(ax);
  });
}

export function CoursesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: rawSemesters, isLoading: semLoading } = useSemesters();
  const { data: courses, isLoading: coursesLoading, error } = useCourses();
  const semesters = useMemo(() => mergedSemesters(rawSemesters ?? []), [rawSemesters]);

  const defaultId = useMemo(() => {
    const foundCurrent = semesters.find((s) => semesterToXnxq01id(s.name) === "2026-2027-1");
    if (foundCurrent) return "2026-2027-1";
    return semesters[0] ? semesterToXnxq01id(semesters[0].name)! : undefined;
  }, [semesters]);

  const [selectedSem, setSelectedSem] = useState<string | undefined>(undefined);
  const xnxq01id = selectedSem ?? defaultId;

  // 按当前教务网 semesterId 匹配学在浙大课程
  const semesterMap = useMemo(
    () => new Map((rawSemesters ?? []).map((s) => [s.id, s])),
    [rawSemesters],
  );

  // 根据当前选择的学期 (xnxq01id) 过滤出对应课程
  const filteredCourses = useMemo(() => {
    if (!courses) return [];
    if (!xnxq01id || xnxq01id === "all") return courses;
    return courses.filter((c) => {
      const sem = semesterMap.get(c.semesterId);
      if (!sem) return false;
      return semesterToXnxq01id(sem.name) === xnxq01id;
    });
  }, [courses, xnxq01id, semesterMap]);

  const { data: timetableData, isLoading: timetableLoading } = useTimetable(
    xnxq01id && xnxq01id !== "all" ? xnxq01id : "",
  );
  const timetableCourseCount = useMemo(() => {
    if (!timetableData || timetableData.length === 0) return 0;
    return new Set(timetableData.map((t) => t.courseName)).size;
  }, [timetableData]);

  const grouped = useMemo(
    () => groupBySemester(filteredCourses, semesterMap),
    [filteredCourses, semesterMap],
  );

  return (
    <Layout
      rightPanel={
        <CoursesRightPanel
          semesters={semesters}
          xnxq01id={xnxq01id}
          selectedSem={selectedSem}
          onSemesterChange={(v) => {
            setSelectedSem(v);
            setSelectedId(null);
          }}
          grouped={grouped}
          totalCourses={filteredCourses.length}
          timetableCourseCount={timetableCourseCount}
          isLoading={semLoading || coursesLoading}
          timetableLoading={timetableLoading}
          errorMessage={error?.message}
          onSelectCourse={setSelectedId}
        />
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zju-primary">课程</h1>
      </div>

      {!xnxq01id ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          未识别到任何学期，请先在学在浙大确认已选课。
        </div>
      ) : xnxq01id === "all" ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          <div className="mb-2 text-2xl text-slate-400">
            <FontAwesomeIcon icon={faCalendarDays} />
          </div>
          <div className="mb-1 font-semibold text-slate-700">已切换为「全部学期」总览</div>
          <div className="mx-auto max-w-md text-xs text-slate-400">
            右侧总览已展示全部历史课程。课表按单学期排列，请在右侧选择具体学期查看当学期课程表。
          </div>
        </div>
      ) : (
        <TimetablePanel xnxq01id={xnxq01id} />
      )}

      {selectedId && (
        <CourseDetailDrawer
          courseId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </Layout>
  );
}

/** 右栏：学期切换 + 课程列表总览 */
function CoursesRightPanel({
  semesters,
  xnxq01id,
  selectedSem,
  onSemesterChange,
  grouped,
  totalCourses,
  timetableCourseCount,
  isLoading,
  timetableLoading,
  errorMessage,
  onSelectCourse,
}: {
  semesters: Semester[];
  xnxq01id: string | undefined;
  selectedSem: string | undefined;
  onSemesterChange: (v: string | undefined) => void;
  grouped: ReturnType<typeof groupBySemester>;
  totalCourses: number;
  timetableCourseCount: number;
  isLoading: boolean;
  timetableLoading: boolean;
  errorMessage: string | undefined;
  onSelectCourse: (id: string) => void;
}) {
  return (
    <RightPanel title="学期总览">
      {/* 学期切换 */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-500">学期</label>
          <span className="text-[11px] text-slate-400">
            {xnxq01id === "all"
              ? (isLoading ? "" : `全部课程 ${totalCourses} 门`)
              : (timetableLoading ? "" : `本学期 ${timetableCourseCount > 0 ? timetableCourseCount : totalCourses} 门`)}
          </span>
        </div>
        <select
          value={selectedSem ?? xnxq01id ?? ""}
          onChange={(e) => onSemesterChange(e.target.value || undefined)}
          disabled={semesters.length === 0}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-zju-primary focus:outline-none disabled:opacity-50"
        >
          {semesters.length === 0 && <option value="">（暂无学期）</option>}
          {semesters.map((s) => {
            const id = semesterToXnxq01id(s.name)!;
            return (
              <option key={id} value={id}>
                {s.name}
              </option>
            );
          })}
          <option value="all">全部学期（所有历史课程）</option>
        </select>
      </div>

      {/* 课程列表 */}
      {errorMessage ? (
        <div className="text-xs text-rose-500">加载失败：{errorMessage}</div>
      ) : isLoading ? (
        <div className="text-xs text-slate-400">加载中…</div>
      ) : grouped.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
          该学期暂无学在浙大课程
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <div key={g.semesterId}>
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span>{g.semesterName}</span>
                <span className="text-[10px] text-slate-400">{g.courses.length} 门</span>
              </div>
              <div className="space-y-1">
                {g.courses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCourse(c.id)}
                    className="w-full rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-left transition hover:border-zju-primary hover:bg-white"
                  >
                    <div className="truncate text-xs font-medium text-slate-700">{c.name}</div>
                    {c.teachingClassName && (
                      <div className="truncate text-[10px] text-slate-400">{c.teachingClassName}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {xnxq01id !== "all" && timetableCourseCount > 0 && timetableCourseCount > totalCourses && (
            <div className="rounded-md bg-slate-50 border border-slate-200/70 p-2.5 text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
              <FontAwesomeIcon icon={faLightbulb} className="text-amber-500 mt-0.5 shrink-0" />
              <span>教务网选课共 {timetableCourseCount} 门；右栏仅列出已在「学在浙大」开通课件空间的课程。</span>
            </div>
          )}
        </div>
      )}
    </RightPanel>
  );
}

function TimetablePanel({ xnxq01id }: { xnxq01id: string }) {
  const { data, isLoading, error, refetch, isFetching } = useTimetable(xnxq01id);
  const entries = data ?? [];

  if (error) {
    return (
      <>
        <ErrorState message={error.message} hint="教务网课表接口可能调整，正在尝试兼容解析。" />
        <button onClick={() => refetch()} className="mt-3 text-sm text-zju-primary">
          重试
        </button>
      </>
    );
  }
  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-sm text-slate-500 hover:text-zju-primary disabled:opacity-50"
        >
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

function CourseDetailDrawer({
  courseId,
  onClose,
}: {
  courseId: string;
  onClose: () => void;
}) {
  const { data: materials, isLoading, error } = useMaterials(courseId);
  const download = useDownloadMaterial();

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative h-full w-full max-w-md overflow-auto bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h3 className="font-semibold text-zju-primary">课程资料</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <div className="p-4">
          {isLoading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error.message} />
          ) : (materials ?? []).length === 0 ? (
            <EmptyHint message="该课程暂无资料" />
          ) : (
            <ul className="space-y-3">
              {materials!.map((m) => (
                <li key={m.id} className="rounded-md border border-slate-200 p-3">
                  <div className="mb-1 text-sm font-medium text-slate-800">{m.title}</div>
                  {m.files.length === 0 ? (
                    <div className="text-xs text-slate-400">无附件</div>
                  ) : (
                    <ul className="space-y-1">
                      {m.files.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs text-slate-600">{f.name}</div>
                            <div className="text-[10px] text-slate-400">{formatBytes(f.size)}</div>
                          </div>
                          <button
                            onClick={() =>
                              download.mutate({
                                courseId,
                                materialId: m.id,
                                fileId: f.id,
                                fileName: f.name,
                                officePdf: isOfficeFile(f.name),
                              })
                            }
                            disabled={download.isPending}
                            className="shrink-0 rounded bg-zju-primary px-2 py-1 text-[11px] text-white hover:bg-zju-light disabled:opacity-50"
                          >
                            下载
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          {download.isPending && (
            <div className="mt-3 text-xs text-slate-400">下载中…</div>
          )}
          {download.isError && (
            <div className="mt-3 text-xs text-rose-500">下载失败：{download.error?.message}</div>
          )}
          {download.isSuccess && (
            <div className="mt-3 text-xs text-emerald-600">已下载：{download.data.fileName}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function groupBySemester(
  courses: Course[],
  semesterMap: Map<string, Semester>,
) {
  const groups = new Map<string, Course[]>();
  for (const c of courses) {
    const list = groups.get(c.semesterId) ?? [];
    list.push(c);
    groups.set(c.semesterId, list);
  }
  return [...groups.entries()]
    .map(([semesterId, list]) => ({
      semesterId,
      semesterName:
        semesterMap.get(semesterId)?.name ??
        (semesterId === "0" ? "其他 / 拓展课程" : semesterId),
      courses: list,
    }))
    .sort((a, b) => b.semesterName.localeCompare(a.semesterName));
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function isOfficeFile(name: string): boolean {
  return /\.(docx?|pptx?|xlsx?)$/i.test(name);
}
