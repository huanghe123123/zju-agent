import { useState } from "react";
import { Layout } from "../components/Layout.js";
import { ErrorState } from "../components/ErrorState.js";
import { Loading } from "../components/Loading.js";
import {
  useCourses,
  useSemesters,
  useMaterials,
  useDownloadMaterial,
} from "../api/zju.js";
import { formatBytes } from "../utils/format.js";
import type { Course, Semester } from "@zju-agent/core";

export function CoursesPage() {
  const { data: semesters, isLoading: semLoading } = useSemesters();
  const { data: courses, isLoading, error } = useCourses();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeSemesters = (semesters ?? []).filter((s) => s.isActive);
  const semesterMap = new Map((semesters ?? []).map((s) => [s.id, s]));

  // 按学期分组；活跃学期优先展示
  const grouped = groupBySemester(courses ?? [], semesterMap, activeSemesters);

  return (
    <Layout>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-zju-primary">课程</h1>
        {(semLoading || isLoading) && (
          <span className="text-sm text-slate-400">加载中…</span>
        )}
      </div>

      {error ? (
        <ErrorState message={error.message} hint="请确认 ZJU 账号已在设置页配置并验证通过。" />
      ) : (courses ?? []).length === 0 && !isLoading ? (
        <EmptyHint message="暂无课程数据" />
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.semesterId}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
                <span>{g.semesterName}</span>
                {g.isActive && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">本学期</span>
                )}
              </h2>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {g.courses.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    selected={selectedId === c.id}
                    onSelect={() => setSelectedId(c.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
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

function CourseCard({
  course,
  selected,
  onSelect,
}: {
  course: Course;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-zju-primary ${
        selected ? "border-zju-primary ring-1 ring-zju-primary" : "border-slate-200"
      }`}
    >
      <div className="truncate text-sm font-medium text-slate-800">{course.name}</div>
      {course.teachingClassName && (
        <div className="mt-0.5 truncate text-xs text-slate-500">{course.teachingClassName}</div>
      )}
    </button>
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
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
  activeSemesters: Semester[],
) {
  const activeIds = new Set(activeSemesters.map((s) => s.id));
  const groups = new Map<string, Course[]>();
  for (const c of courses) {
    const list = groups.get(c.semesterId) ?? [];
    list.push(c);
    groups.set(c.semesterId, list);
  }
  return [...groups.entries()]
    .map(([semesterId, list]) => ({
      semesterId,
      semesterName: semesterMap.get(semesterId)?.name ?? semesterId,
      isActive: activeIds.has(semesterId),
      courses: list,
    }))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.semesterName.localeCompare(b.semesterName));
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

/** Office 文件后缀判定：这类文件走浙大预览版（PDF 化）下载，避免直接 blob 拿到非预期格式 */
function isOfficeFile(name: string): boolean {
  return /\.(docx?|pptx?|xlsx?)$/i.test(name);
}
