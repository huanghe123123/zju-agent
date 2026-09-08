import { useMemo } from "react";
import { type TimetableEntry, mergeTimetableEntries } from "@zju-agent/core";

const DAY_LABELS = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;
const MAX_SECTION = 13;

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

export function TimetableGrid({ entries: rawEntries }: { entries: TimetableEntry[] }) {
  const entries = useMemo(() => mergeTimetableEntries(rawEntries), [rawEntries]);
  const courseNames = useMemo(
    () => [...new Set(entries.map((e) => e.courseName))],
    [entries],
  );
  const colorOf = (name: string) =>
    COURSE_COLORS[courseNames.indexOf(name) % COURSE_COLORS.length]!;

  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      {/* 使用 table 布局避免 grid contents 导致的列错位 */}
      <table
        className="border-collapse"
        style={{ minWidth: 750, tableLayout: "fixed" }}
      >
        <thead>
          <tr className="sticky top-0 z-10 bg-slate-50">
            <th
              className="border-b border-r border-slate-200 p-1.5 text-center text-[11px] font-medium text-slate-500"
              style={{ width: 48 }}
            >
              节次
            </th>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <th
                key={`h-${d}`}
                className="border-b border-r border-slate-200 p-1.5 text-center text-[11px] font-medium text-slate-500"
              >
                {DAY_LABELS[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: MAX_SECTION }, (_, i) => {
            const sec = i + 1;
            return (
              <tr key={`row-${sec}`}>
                <td className="border-b border-r border-slate-100 bg-slate-50/50 p-1 text-center text-[10px] text-slate-400">
                  {sec}
                </td>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                  // 找到该格子内的课程
                  const cellEntries = entries.filter(
                    (e) =>
                      e.weekday === d &&
                      e.startSection <= sec &&
                      e.endSection >= sec,
                  );
                  // 只在课程起始格渲染卡片（用 rowSpan 跨行）
                  const startEntries = cellEntries.filter(
                    (e) => e.startSection === sec,
                  );
                  return (
                    <td
                      key={`cell-${d}-${sec}`}
                      className="relative border-b border-r border-slate-100 align-top"
                      style={{ height: 48, padding: 0 }}
                    >
                      {startEntries.map((e, idx) => {
                        const span = Math.max(1, e.endSection - e.startSection + 1);
                        const height = span * 48 + (span - 1) * 1; // compensate borders
                        const count = startEntries.length;
                        const widthPct = 100 / count;
                        return (
                          <div
                            key={e.id}
                            className={`m-0.5 overflow-hidden rounded border p-1.5 text-xs shadow-sm ${colorOf(e.courseName)}`}
                            style={{
                              position: "absolute",
                              top: 2,
                              left: count === 1 ? 2 : `calc(${idx * widthPct}% + 2px)`,
                              width: count === 1 ? "calc(100% - 4px)" : `calc(${widthPct}% - 4px)`,
                              height: height - 4,
                              zIndex: 5,
                            }}
                          >
                            <div className="truncate font-medium">{e.courseName}</div>
                            {e.teacher && (
                              <div className="truncate text-[10px] opacity-70">{e.teacher}</div>
                            )}
                            {e.location && (
                              <div className="truncate text-[10px] opacity-70">{e.location}</div>
                            )}
                            {e.weeks.length > 0 && (
                              <div className="mt-0.5 text-[10px] opacity-50">
                                {compressWeeks(e.weeks)} 周
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function compressWeeks(weeks: number[]): string {
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
