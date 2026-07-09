import { Layout } from "../components/Layout.js";
import { ErrorState } from "../components/ErrorState.js";
import { Loading } from "../components/Loading.js";
import {
  useAllAssignments,
  useCourseAssignments,
  type DownloadRecord,
  useDownloads,
} from "../api/zju.js";
import {
  formatDateTime,
  formatBytes,
  deadlineUrgency,
  urgencyClass,
} from "../utils/format.js";
import type { Assignment } from "@zju-agent/core";
import { useState } from "react";

export function AssignmentsPage() {
  const { data, isLoading, error, refetch, isFetching } = useAllAssignments();
  const [tab, setTab] = useState<"pending" | "submitted">("pending");

  const all = data ?? [];
  const pending = all.filter((a) => !a.submitted);
  const submitted = all.filter((a) => a.submitted);
  const list = tab === "pending" ? pending : submitted;

  return (
    <Layout>
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

      <div className="mb-4 flex gap-1 rounded-md border border-slate-200 bg-white p-1">
        <TabBtn active={tab === "pending"} onClick={() => setTab("pending")}>
          待提交（{pending.length}）
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
          {tab === "pending" ? "暂无待提交作业 🎉" : "暂无已提交作业"}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <AssignmentItem key={`${a.courseId}-${a.id}`} assignment={a} />
          ))}
        </ul>
      )}

      <RecentDownloads />
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
      className={`flex-1 rounded px-3 py-1.5 text-sm ${
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
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-800">{assignment.title}</div>
          <div className="mt-0.5 text-xs text-slate-500">{assignment.courseName}</div>
        </div>
        {assignment.submitted ? (
          <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">已提交</span>
        ) : urgency !== "none" ? (
          <span className={`shrink-0 text-xs ${urgencyClass(urgency)}`}>
            {urgency === "overdue" ? "已逾期" : "待提交"}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        <span>截止：{formatDateTime(assignment.deadline)}</span>
        {assignment.attachments.length > 0 && (
          <span>附件 {assignment.attachments.length}</span>
        )}
      </div>
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

function RecentDownloads() {
  const { data } = useDownloads();
  const records = (data?.records ?? []).slice(0, 5);
  if (records.length === 0) return null;
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-slate-600">最近下载</h2>
      <ul className="space-y-1">
        {records.map((r: DownloadRecord) => (
          <li key={r.id} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-xs">
            <span className="truncate">{r.fileName}</span>
            <span className="ml-2 shrink-0 text-slate-400">{formatBytes(r.size)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
