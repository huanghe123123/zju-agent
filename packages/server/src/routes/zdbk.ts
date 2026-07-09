/**
 * 教务网 (zdbk.zju.edu.cn) 路由：考试安排 + 课程表 + 成绩。
 * 见 ZJU_CAMPUS_AGENT_PROJECT.md 第 8.3 / 10.3 节。
 *
 * 路由：
 *   GET /api/zju/exams        — 考试安排（默认学期：活跃→最近）
 *   GET /api/zju/timetable    — 课程表（默认学期：活跃→最近；可指定 xnxq01id）
 *   GET /api/zju/grades       — 成绩（默认学期：活跃→最近；可指定 xnxq01id）
 *
 * 学期选择：无 query 时取「活跃学期」；无活跃学期则取「最近一次」。
 * stuId = ZJU 凭据用户名。
 * 学期标识跨系统映射：学在浙大 "2024-2025春夏" → 教务网 "2024-2025-2"。
 */

import type { FastifyPluginAsync } from "fastify";
import {
  wrap,
  AppError,
  ErrorCode,
  type Exam,
  type TimetableEntry,
  type Grade,
  type Semester,
} from "@zju-agent/core";
import type { ServicesContainer } from "../services.js";
import type { ServerConfig } from "../config/env.js";
import { activeXnxq01ids, semesterToXnxq01id } from "@zju-agent/zju-services";

const CACHE_KEYS = {
  exams: (xnxq: string) => `zdbk:exams:${xnxq}`,
  timetable: (xnxq: string) => `zdbk:timetable:${xnxq}`,
  grades: (xnxq: string) => `zdbk:grades:${xnxq}`,
} as const;

/** 学期展示顺序：秋冬(1) 在前，春夏(2) 在后；按年份降序（最近在前）。 */
function compareSemesterForSort(a: Semester, b: Semester): number {
  const ax = semesterToXnxq01id(a.name);
  const bx = semesterToXnxq01id(b.name);
  // 解析不出学期的排到后面
  if (!ax && bx) return 1;
  if (ax && !bx) return -1;
  if (!ax && !bx) return a.name.localeCompare(b.name);
  // ax/bx 形如 "2024-2025-2"：按字符串降序即可（年份大、term 大的排前）
  return bx!.localeCompare(ax!);
}

export function zdbkRoutes(
  deps: ServicesContainer & { config: ServerConfig },
): FastifyPluginAsync {
  return async (app) => {
    // --- 考试安排 ---
    app.get<{
      Querystring: { xnxq01id?: string };
    }>("/exams", async (req) => {
      return wrap(async () => {
        const { stuId, semesters } = await resolveStuAndSemesters(deps);
        const target = pickSemester(semesters, req.query.xnxq01id);
        const cacheKey = CACHE_KEYS.exams(target);
        const cached = deps.cache.get<Exam[]>(cacheKey);
        if (cached) return cached;
        const adapters = await deps.auth.getServiceAdapters();
        // getExams 内部按活跃学期过滤；此处把 target 作为唯一活跃学期传入
        const exams = await adapters.zdbk.getExams(stuId, [target]);
        deps.cache.set(cacheKey, exams);
        return exams;
      });
    });

    // --- 课程表 ---
    app.get<{
      Querystring: { xnxq01id?: string };
    }>("/timetable", async (req) => {
      return wrap(async () => {
        const { stuId, semesters } = await resolveStuAndSemesters(deps);
        const target = pickSemester(semesters, req.query.xnxq01id);
        const cacheKey = CACHE_KEYS.timetable(target);
        const cached = deps.cache.get<TimetableEntry[]>(cacheKey);
        if (cached) return cached;
        const adapters = await deps.auth.getServiceAdapters();
        const entries = await adapters.zdbk.getTimetable(stuId, target);
        deps.cache.set(cacheKey, entries);
        return entries;
      });
    });

    // --- 成绩 ---
    app.get<{
      Querystring: { xnxq01id?: string };
    }>("/grades", async (req) => {
      return wrap(async () => {
        const { stuId, semesters } = await resolveStuAndSemesters(deps);
        const target = pickSemester(semesters, req.query.xnxq01id);
        const cacheKey = CACHE_KEYS.grades(target);
        const cached = deps.cache.get<Grade[]>(cacheKey);
        if (cached) return cached;
        const adapters = await deps.auth.getServiceAdapters();
        const grades = await adapters.zdbk.getGrades(stuId, target);
        deps.cache.set(cacheKey, grades);
        return grades;
      });
    });
  };
}

/** 解析 stuId（= ZJU 用户名）+ 学期列表（带缓存优先） */
async function resolveStuAndSemesters(deps: ServicesContainer): Promise<{
  stuId: string;
  semesters: Semester[];
}> {
  const cred = await deps.auth.getCredential();
  if (!cred) {
    throw new AppError(
      ErrorCode.ZJU_CREDENTIAL_MISSING,
      "尚未配置 ZJU 账号，无法访问校园服务。",
      { retryable: false },
    );
  }
  let semesters = deps.cache.get<Semester[]>("courses:semesters");
  if (!semesters) {
    const adapters = await deps.auth.getServiceAdapters();
    semesters = await adapters.courses.getSemesters();
    deps.cache.set("courses:semesters", semesters);
  }
  return { stuId: cred.username, semesters };
}

/**
 * 选定目标学期：
 * - 显式指定 xnxq01id → 校验存在，回退到默认
 * - 无指定 → 取活跃学期；无活跃则取最近一次
 * 永不抛 ZJU_SERVICE_UNAVAILABLE（课表无数据返回空数组，由前端展示空态）。
 */
function pickSemester(
  semesters: Semester[],
  requested?: string,
): string {
  const ids = new Map<string, Semester>();
  for (const s of semesters) {
    const id = semesterToXnxq01id(s.name);
    if (id) ids.set(id, s);
  }
  if (requested && ids.has(requested)) return requested;
  // 活跃学期（合并后的，去重）
  const active = activeXnxq01ids(semesters);
  if (active.length > 0) {
    // 取列表顺序里第一个活跃的（一般是当前学期）
    return active[0]!;
  }
  // 无活跃 → 取最近一次（按学年降序、秋冬优先）
  const sorted = [...ids.values()].sort(compareSemesterForSort);
  const first = sorted[0];
  if (first) {
    return semesterToXnxq01id(first.name)!;
  }
  // 极端兜底：连学期都没有
  throw new AppError(
    ErrorCode.ZJU_SERVICE_UNAVAILABLE,
    "未识别到任何学期。",
    { retryable: false },
  );
}
