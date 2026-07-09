import { Layout, RightPanel } from "../components/Layout.js";
import { ErrorState } from "../components/ErrorState.js";
import { Loading } from "../components/Loading.js";
import {
  useAllAssignments,
  useCourseAssignments,
} from "../api/zju.js";
import {
  formatDateTime,
  deadlineUrgency,
  urgencyClass,
} from "../utils/format.js";
import type { Assignment } from "@zju-agent/core";
import { useState } from "react";

const DEFAULT_URGENT_HOURS = 24;

export function AssignmentsPage() {
  const { data, isLoading, error, refetch, isFetching } = useAllAssignments();
  const [tab, setTab] = useState<"urgent" | "relaxed" | "overdue" | "submitted">("urgent");
  const [urgentHours, setUrgentHours] = useState(DEFAULT_URGENT_HOURS);

  const all = data ?? [];
  const now = Date.now();
  const urgentThreshold = now + urgentHours * 3600_000;

  const overdue = all.filter(
    (a) => !a.submitted && a.deadline && Date.parse(a.deadline) <= now,
  );
  const urgent = all.filter(
    (a) => !a.submitted && a.deadline && Date.parse(a.deadline) > now && Date.parse(a.deadline) <= urgentThreshold,
  );
  const relaxed = all.filter(
    (a) => !a.submitted && a.deadline && Date.parse(a.deadline) > urgentThreshold,
  );
  const submitted = all.filter((a) => a.submitted);

  const list = tab === "urgent" ? urgent : tab === "relaxed" ? relaxed : tab === "overdue" ? overdue : submitted;

  return (
    <Layout
      rightPanel={
        <RightPanel title="分类设置">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                将截止阈值
              </label>
              <input
                type="range"
                min={1}
                max={72}
                value={urgentHours}
                onChange={(e) => setUrgentHours(Number(e.target.value))}
                className="w-full accent-zju-primary"
              />
              <div className="text-center text-xs text-slate-500">
                距截止 ≤ {urgentHours} 小时
              </div>
            </div>
            <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 p-2 text-xs">
              <div className="flex justify-between">
                <span className="text-rose-600">🔴 将截止</span>
                <span className="font-medium">{urgent.length} 项</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-600">🟡 还不急</span>
                <span className="font-medium">{relaxed.length} 项</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">⚫ 已截止</span>
                <span className="font-medium">{overdue.length} 项</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="text-emerald-600">✓ 已提交</span>
                <span className="font-medium">{submitted.length} 项</span>
              </div>
            </div>
          </div>
        </RightPanel>
      }
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-zju-primary">作业</h1>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-sm text-slate-500 hover:text-zju-primary disabled:opacity-50"
        >
          {isFetching ? "刷新中…" : "刷新"}
        </button>
      </div>

      {/* 四分类 Tab */}
      <div className="mb-4 flex gap-1 rounded-md border border-slate-200 bg-white p-1">
        <TabBtn active={tab === "urgent"} onClick={() => setTab("urgent")}>
          将截止（{urgent.length}）
        </TabBtn>
        <TabBtn active={tab === "relaxed"} onClick={() => setTab("relaxed")}>
          还不急（{relaxed.length}）
        </TabBtn>
        <TabBtn active={tab === "overdue"} onClick={() => setTab("overdue")}>
          已截止（{overdue.length}）
        </TabBtn>
        <TabBtn active={tab === "submitted"} onClick={() => setTab("submitted")}>
          已提交（{submitted.length}）
        </TabBtn>
      </div>

      {error ? (
        <ErrorState message={error.message} hint="请确认 ZJU 账号已验证。" />
      ) : isLoading ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          {tab === "urgent"
            ? "暂无紧急作业 🎉"
            : tab === "relaxed"
              ? "暂无作业"
              : tab === "overdue"
                ? "暂无逾期作业 🎉"
                : "暂无已提交作业"}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <AssignmentItem key={`${a.courseId}-${a.id}`} assignment={a} />
          ))}
        </ul>
      )}

    </Layout>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 whitespace-nowrap rounded px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-zju-primary text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function AssignmentItem({ assignment }: { assignment: Assignment }) {
  const urgency = deadlineUrgency(assignment.deadline);
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-800">{assignment.title}</div>
          <div className="mt-0.5 text-xs text-slate-500">{assignment.courseName}</div>
        </div>
        {assignment.submitted ? (
          <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
            已提交
          </span>
        ) : urgency !== "none" ? (
          <span className={`shrink-0 text-xs ${urgencyClass(urgency)}`}>
            {urgency === "overdue" ? "已逾期" : urgency === "urgent" ? "即将截止" : "还不急"}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        <span>截止：{formatDateTime(assignment.deadline)}</span>
        {assignment.attachments.length > 0 && (
          <span>附件 {assignment.attachments.length}</span>
        )}
      </div>
      {assignment.description && (
        <div
          className="mt-2 text-xs text-slate-500 [&_p]:mb-1"
          dangerouslySetInnerHTML={{ __html: assignment.description }}
        />
      )}
    </li>
  );
}

/** 课程维度作业（预留入口，单课程查看用）。 */
export function CourseAssignmentsPanel({ courseId }: { courseId: string }) {
  const { data, isLoading, error } = useCourseAssignments(courseId);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  return (
    <ul className="space-y-2">
      {(data ?? []).map((a) => (
        <AssignmentItem key={a.id} assignment={a} />
      ))}
    </ul>
  );
}

