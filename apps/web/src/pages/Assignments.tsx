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
} from "../utils/format.js";
import { sanitizeHtml } from "../utils/sanitizeHtml.js";
import type { Assignment } from "@zju-agent/core";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Segmented,
} from "@crisp-ui-kit/crisp";

const DEFAULT_URGENT_HOURS = 24;

export function AssignmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get("tab");
  const initialTab =
    queryTab === "urgent" || queryTab === "relaxed" || queryTab === "overdue" || queryTab === "submitted"
      ? queryTab
      : "urgent";

  const { data, isLoading, error, refetch, isFetching } = useAllAssignments();
  const [tab, setTab] = useState<"urgent" | "relaxed" | "overdue" | "submitted">(initialTab);

  useEffect(() => {
    if (queryTab === "urgent" || queryTab === "relaxed" || queryTab === "overdue" || queryTab === "submitted") {
      setTab(queryTab);
    }
  }, [queryTab]);
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zju-primary">作业</h1>
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

      {/* 四分类 Crisp Segmented Tab */}
      <div className="mb-4 overflow-x-auto pb-1">
        <Segmented
          value={tab}
          onValueChange={(val) => {
            const nextTab = val as "urgent" | "relaxed" | "overdue" | "submitted";
            setTab(nextTab);
            setSearchParams({ tab: nextTab });
          }}
          options={[
            {
              value: "urgent",
              label: (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <span>将截止</span>
                  <Badge tone="danger" size="small">
                    {urgent.length}
                  </Badge>
                </span>
              ),
            },
            {
              value: "relaxed",
              label: (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <span>还不急</span>
                  <Badge tone="warning" size="small">
                    {relaxed.length}
                  </Badge>
                </span>
              ),
            },
            {
              value: "overdue",
              label: (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <span>已截止</span>
                  <Badge tone="neutral" size="small">
                    {overdue.length}
                  </Badge>
                </span>
              ),
            },
            {
              value: "submitted",
              label: (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <span>已提交</span>
                  <Badge tone="success" size="small">
                    {submitted.length}
                  </Badge>
                </span>
              ),
            },
          ]}
        />
      </div>

      {error ? (
        <ErrorState message={error.message} hint="请确认 ZJU 账号已验证。" />
      ) : isLoading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Card raised className="p-8 text-center">
          <EmptyState
            variant="default"
            icon={<span className="text-3xl">🎉</span>}
            title={
              tab === "urgent"
                ? "暂无紧急作业 🎉"
                : tab === "relaxed"
                  ? "暂无常规作业"
                  : tab === "overdue"
                    ? "暂无逾期作业 🎉"
                    : "暂无已提交作业"
            }
            description="当前分类下没有相关作业记录。"
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {list.map((a) => (
            <AssignmentItem key={`${a.courseId}-${a.id}`} assignment={a} />
          ))}
        </div>
      )}

    </Layout>
  );
}

function AssignmentItem({ assignment }: { assignment: Assignment }) {
  const urgency = deadlineUrgency(assignment.deadline);
  return (
    <Card raised interactive className="p-4 transition-all duration-150">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{assignment.title}</div>
          <div className="mt-0.5 text-xs text-slate-500">{assignment.courseName}</div>
        </div>
        {assignment.submitted ? (
          <Badge tone="success" size="small">
            已提交
          </Badge>
        ) : urgency !== "none" ? (
          <Badge
            tone={urgency === "overdue" ? "danger" : urgency === "urgent" ? "warning" : "neutral"}
            dot={urgency === "urgent"}
            size="small"
          >
            {urgency === "overdue" ? "已逾期" : urgency === "urgent" ? "即将截止" : "还不急"}
          </Badge>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        <span>截止：{formatDateTime(assignment.deadline)}</span>
        {assignment.attachments.length > 0 && (
          <Badge tone="neutral" size="small">
            附件 {assignment.attachments.length}
          </Badge>
        )}
      </div>
      {assignment.description && (
        <div
          className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600 [&_p]:mb-1"
          // 作业描述来自学在浙大富文本，必须经白名单消毒后再注入，防存储型 XSS
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.description) }}
        />
      )}
    </Card>
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

