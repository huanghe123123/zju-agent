import { Layout, RightPanel } from "../components/Layout.js";
import { ErrorState } from "../components/ErrorState.js";
import { Loading } from "../components/Loading.js";
import {
  useSemesters,
  useExams,
} from "../api/zju.js";
import { formatDateTime } from "../utils/format.js";
import { parseExamTimestamp } from "../utils/format.js";
import type { Exam, Semester } from "@zju-agent/core";
import { useMemo, useState } from "react";
import { Badge, Button, Card } from "@crisp-ui-kit/crisp";

/** 学在浙大学期名 → 教务网 xnxq01id */
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
    if (!existing) {
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
  const { data: rawSemesters } = useSemesters();
  const semesters = useMemo(() => mergedSemesters(rawSemesters ?? []), [rawSemesters]);

  // 默认学期：时间最近
  const defaultId = useMemo(() => {
    return semesters[0] ? semesterToXnxq01id(semesters[0].name)! : undefined;
  }, [semesters]);

  const [selected, setSelected] = useState<string | undefined>(undefined);
  const xnxq01id = selected ?? defaultId;

  return (
    <Layout
      rightPanel={
        <RightPanel title="学期切换">
          <select
            value={xnxq01id ?? ""}
            onChange={(e) => setSelected(e.target.value || undefined)}
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
          </select>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            <p className="font-medium mb-1">提醒规则（默认）</p>
            <p>考试前 1 天、2 小时、30 分钟各提醒一次。可在设置中调整。</p>
          </div>
        </RightPanel>
      }
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold text-zju-primary">考试安排</h1>
      </div>

      {!xnxq01id ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          未识别到任何学期，请先在学在浙大确认已选课。
        </div>
      ) : (
        <ExamsPanel xnxq01id={xnxq01id} />
      )}
    </Layout>
  );
}

function ExamsPanel({ xnxq01id }: { xnxq01id: string }) {
  const { data, isLoading, error, refetch, isFetching } = useExams(xnxq01id);
  const exams = data ?? [];
  const now = Date.now();

  const upcoming = exams
    .filter((e) => {
      const ts = parseExamTimestamp(e.time);
      return !Number.isNaN(ts) && ts >= now;
    })
    .sort((a, b) => parseExamTimestamp(a.time) - parseExamTimestamp(b.time));

  const past = exams
    .filter((e) => {
      const ts = parseExamTimestamp(e.time);
      return !Number.isNaN(ts) && ts < now;
    })
    .sort((a, b) => parseExamTimestamp(b.time) - parseExamTimestamp(a.time));

  const noTime = exams.filter((e) => !e.time || Number.isNaN(parseExamTimestamp(e.time)));

  if (error) {
    return (
      <>
        <ErrorState message={error.message} hint="请确认 ZJU 账号已验证，且教务网可访问。" />
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
        <Button
          intent="neutral"
          size="sm"
          onClick={() => refetch()}
          loading={isFetching}
          className="text-xs"
        >
          {isFetching ? "刷新中…" : "刷新"}
        </Button>
      </div>

      <Section title="待考科目" exams={upcoming} emptyText="本学期暂无待考科目安排 🎉" />
      <Section title="已结束" exams={past} emptyText="无已结束的考试" />
      <Section title="待安排时间" exams={noTime} emptyText="无待安排的考试" />
    </div>
  );
}

function Section({
  title,
  exams,
  emptyText,
}: {
  title: string;
  exams: Exam[];
  emptyText: string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        {title}（{exams.length}）
      </h2>
      {exams.length === 0 ? (
        emptyText ? (
          <div className="text-xs text-slate-400">{emptyText}</div>
        ) : null
      ) : (
        <div className="space-y-2.5">
          {exams.map((e) => (
            <ExamItem key={e.id} exam={e} />
          ))}
        </div>
      )}
    </section>
  );
}

function ExamItem({ exam }: { exam: Exam }) {
  const ts = parseExamTimestamp(exam.time);
  const now = Date.now();

  const badge = (() => {
    if (Number.isNaN(ts)) {
      return (
        <Badge tone="neutral" size="small">
          时间待定
        </Badge>
      );
    }
    if (ts < now) {
      return (
        <Badge tone="neutral" size="small">
          已结束
        </Badge>
      );
    }

    const diffMs = ts - now;
    const diffHours = Math.floor(diffMs / 3600_000);
    const diffDays = Math.ceil(diffMs / (24 * 3600_000));

    if (diffHours <= 24) {
      return (
        <Badge tone="danger" dot size="small">
          即将开考 · 仅剩 {Math.max(1, diffHours)} 小时
        </Badge>
      );
    }
    if (diffDays <= 7) {
      return (
        <Badge tone="warning" size="small">
          近期待考 · 距今 {diffDays} 天
        </Badge>
      );
    }
    return (
      <Badge tone="neutral" size="small">
        待考 · 距今 {diffDays} 天
      </Badge>
    );
  })();

  return (
    <Card raised interactive className="p-4 transition-all duration-150">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{exam.courseName}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {exam.semester ? `学期 ${exam.semester}` : ""}
          </div>
        </div>
        {badge}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
        <div>
          <div className="text-slate-400 mb-0.5">考试时间</div>
          <div className="font-medium text-slate-800">{formatDateTime(exam.time)}</div>
        </div>
        <div>
          <div className="text-slate-400 mb-0.5">地点</div>
          <div className="truncate font-medium text-slate-800">{exam.location || "待公布"}</div>
        </div>
        <div>
          <div className="text-slate-400 mb-0.5">座位</div>
          <div className="font-medium text-slate-800">{exam.seat || "待公布"}</div>
        </div>
      </div>
    </Card>
  );
}
