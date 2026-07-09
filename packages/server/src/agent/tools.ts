/**
 * 工具注册表。
 * 见 ZJU_CAMPUS_AGENT_PROJECT.md 第 9.2 / 9.3 节。
 *
 * 工具分两类：
 * - 查询类（read）：直接执行，无需确认
 * - 操作类（write/payment/external_download）：执行前需用户确认（PendingConfirmation 流）
 *
 * 工具的 execute 只在后端调用，前端不直接执行。
 * 工具依赖运行时服务（auth / zju 适配器 / 缓存等），通过 ToolDeps 注入。
 */

import type {
  AgentTool,
  ToolResult,
  ToolContext,
  Semester,
  Course,
} from "@zju-agent/core";
import type { ServicesContainer } from "../services.js";
import type { ServerConfig } from "../config/env.js";
import { activeXnxq01ids, semesterToXnxq01id } from "@zju-agent/zju-services";
import { logger } from "../config/logger.js";

export type ToolDeps = ServicesContainer & { config: ServerConfig };

/** 解析 stuId + 活跃学期（带缓存优先），供 zdbk 工具复用 */
async function resolveStuAndSemesters(
  deps: ToolDeps,
): Promise<{ stuId: string; semesters: Semester[] }> {
  const cred = await deps.auth.getCredential();
  if (!cred) {
    return { stuId: "", semesters: [] };
  }
  let semesters = deps.cache.get<Semester[]>("courses:semesters");
  if (!semesters) {
    const adapters = await deps.auth.getServiceAdapters();
    semesters = await adapters.courses.getSemesters();
    deps.cache.set("courses:semesters", semesters);
  }
  return { stuId: cred.username, semesters };
}

function activeIds(semesters: Semester[]): string[] {
  return activeXnxq01ids(semesters);
}

/** 选取目标学期：活跃 → 最近（与路由 pickSemester 保持一致） */
function pickTargetSemester(
  semesters: Semester[],
  requested?: string,
): string | undefined {
  if (requested) {
    // 验证请求的学期是否存在于已知列表中
    for (const s of semesters) {
      if (semesterToXnxq01id(s.name) === requested) return requested;
    }
  }
  const active = activeIds(semesters);
  if (active.length > 0) return active[0];
  // 无活跃学期 → 取最近一次
  const ids = new Map<string, Semester>();
  for (const s of semesters) {
    const id = semesterToXnxq01id(s.name);
    if (id) ids.set(id, s);
  }
  const sorted = [...ids.keys()].sort((a, b) => b.localeCompare(a));
  return sorted[0];
}

/** 工厂：构建工具实例。依赖运行时服务，故每次请求构建一次。 */
export function buildTools(deps: ToolDeps): AgentTool[] {
  return [
    makeGetCourses(deps),
    makeGetAssignments(deps),
    makeGetCourseMaterials(deps),
    makeGetQuizzes(deps),
    makeGetExams(deps),
    makeGetTimetable(deps),
    makeDownloadCourseMaterial(deps),
    makeBatchDownload(deps),
    makeGetWeather(deps),
  ];
}

// ---------- 查询类工具 ----------

function makeGetCourses(deps: ToolDeps): AgentTool {
  return {
    name: "zju_get_courses",
    description:
      "查询课程列表（学在浙大）。返回课程 id、名称、学期、教学班。默认返回所有学期课程，也可指定 semester 过滤（格式 \"2024-2025-1\"=秋冬 或 \"2024-2025-2\"=春夏）。用户询问\"我有哪些课\"\"这学期课程\"时调用。",
    inputSchema: {
      type: "object",
      properties: {
        semester: {
          type: "string",
          description: "可选，教务网学期 id，如 \"2024-2025-2\"。不传则返回所有学期课程。",
        },
      },
      additionalProperties: false,
    },
    riskLevel: "read",
    requiresConfirmation: false,
    async execute(input, ctx): Promise<ToolResult> {
      return runRead(ctx, async () => {
        const semesterId = (input as { semester?: string } | null)?.semester;
        const cached = deps.cache.get("courses:list");
        if (cached) return semesterId ? filterBySemester(cached as Course[], semesterId) : cached;
        const adapters = await deps.auth.getServiceAdapters();
        const courses = await adapters.courses.getCourses();
        deps.cache.set("courses:list", courses);
        return semesterId ? filterBySemester(courses, semesterId) : courses;
      });
    },
  };
}

function makeGetAssignments(deps: ToolDeps): AgentTool {
  return {
    name: "zju_get_assignments",
    description:
      "查询待办作业（学在浙大）。聚合所有课程未关闭的作业，按截止时间升序。用户问“我最近有什么作业”“哪些作业快到期”时调用。",
    inputSchema: {
      type: "object",
      properties: {
        onlyPending: {
          type: "boolean",
          description: "是否只返回未提交作业，默认 true",
        },
      },
      additionalProperties: false,
    },
    riskLevel: "read",
    requiresConfirmation: false,
    async execute(input, ctx): Promise<ToolResult> {
      return runRead(ctx, async () => {
        const onlyPending =
          (input as { onlyPending?: boolean } | null)?.onlyPending ?? true;
        const cached = deps.cache.get<unknown[]>("courses:assignments:all");
        let all = cached;
        if (!all) {
          const adapters = await deps.auth.getServiceAdapters();
          const courses = await adapters.courses.getCourses();
          deps.cache.set("courses:list", courses);
          const list: unknown[] = [];
          for (const c of courses) {
            try {
              const a = await adapters.courses.getAssignments(c.id, c.name);
              deps.cache.set(`courses:assignments:${c.id}`, a);
              list.push(...a);
            } catch (err) {
              logger.warn("工具获取作业失败", {
                courseId: c.id,
                message: err instanceof Error ? err.message : String(err),
              });
            }
          }
          deps.cache.set("courses:assignments:all", list, 10 * 60_000);
          all = list;
        }
        const filtered = onlyPending
          ? (all as Array<{ submitted?: boolean }>).filter((a) => !a.submitted)
          : all;
        return filtered;
      });
    },
  };
}

function makeGetCourseMaterials(deps: ToolDeps): AgentTool {
  return {
    name: "zju_get_course_materials",
    description:
      "查询某门课程的资料列表（学在浙大）。返回资料条目与可下载文件。用户问“某课有哪些课件”时调用。",
    inputSchema: {
      type: "object",
      properties: {
        courseId: { type: "string", description: "课程 id" },
      },
      required: ["courseId"],
      additionalProperties: false,
    },
    riskLevel: "read",
    requiresConfirmation: false,
    async execute(input, ctx): Promise<ToolResult> {
      return runRead(ctx, async () => {
        const courseId = (input as { courseId?: string } | null)?.courseId;
        if (!courseId) {
          return { ok: false, error: { code: "TOOL_INPUT_INVALID", message: "缺少 courseId" } };
        }
        const adapters = await deps.auth.getServiceAdapters();
        return adapters.courses.getMaterials(courseId);
      });
    },
  };
}

function makeGetQuizzes(deps: ToolDeps): AgentTool {
  return {
    name: "zju_get_quizzes",
    description:
      "查询某门课程的在线测试/小测列表（学在浙大）。注意这是课程内的在线测验，不是教务网期末考试安排。用户问“某课有没有小测”“在线测试”时调用。",
    inputSchema: {
      type: "object",
      properties: {
        courseId: { type: "string", description: "课程 id" },
      },
      required: ["courseId"],
      additionalProperties: false,
    },
    riskLevel: "read",
    requiresConfirmation: false,
    async execute(input, ctx): Promise<ToolResult> {
      return runRead(ctx, async () => {
        const courseId = (input as { courseId?: string } | null)?.courseId;
        if (!courseId) {
          return { ok: false, error: { code: "TOOL_INPUT_INVALID", message: "缺少 courseId" } };
        }
        const adapters = await deps.auth.getServiceAdapters();
        // 用课程名而非 id 作为 courseName，提升可读性
        let courseName = courseId;
        let courses = deps.cache.get<Course[]>("courses:list");
        if (!courses) {
          courses = await adapters.courses.getCourses();
          deps.cache.set("courses:list", courses);
        }
        const found = courses.find((c) => c.id === courseId);
        if (found) courseName = found.name;
        return adapters.courses.getQuizzes(courseId, courseName);
      });
    },
  };
}

function makeGetExams(deps: ToolDeps): AgentTool {
  return {
    name: "zju_get_exams",
    description:
      "查询考试安排（教务网）。返回期末与期中考试，含时间、地点、座位号，按时间升序。默认返回当前学期，也可通过 semester 指定学期（格式 \"2024-2025-2\"=春夏）。用户问“我有什么考试”“考试安排”“上学期考了什么”时调用。",
    inputSchema: {
      type: "object",
      properties: {
        semester: {
          type: "string",
          description: "可选，教务网学期 id，如 \"2024-2025-2\"。不传则取当前活跃学期。",
        },
      },
      additionalProperties: false,
    },
    riskLevel: "read",
    requiresConfirmation: false,
    async execute(input, ctx): Promise<ToolResult> {
      return runRead(ctx, async () => {
        const { stuId, semesters } = await resolveStuAndSemesters(deps);
        const reqSemester = (input as { semester?: string } | null)?.semester;
        const target = pickTargetSemester(semesters, reqSemester);
        if (!target) return [];
        const cacheKey = `zdbk:exams:${target}`;
        const cached = deps.cache.get(cacheKey);
        if (cached) return cached;
        const adapters = await deps.auth.getServiceAdapters();
        const exams = await adapters.zdbk.getExams(stuId, [target]);
        deps.cache.set(cacheKey, exams);
        return exams;
      });
    },
  };
}

function makeGetTimetable(deps: ToolDeps): AgentTool {
  return {
    name: "zju_get_timetable",
    description:
      "查询课程表（教务网）。返回课表条目，含课程名、教师、地点、星期、节次、周次。默认返回当前学期，也可通过 semester 指定学期（格式 \"2024-2025-1\"=秋冬）。用户问“我有什么课”“课表”“明天有什么课”“上学期课表”时调用。",
    inputSchema: {
      type: "object",
      properties: {
        semester: {
          type: "string",
          description: "可选，教务网学期 id，如 \"2024-2025-1\"。不传则取当前活跃学期。",
        },
      },
      additionalProperties: false,
    },
    riskLevel: "read",
    requiresConfirmation: false,
    async execute(input, ctx): Promise<ToolResult> {
      return runRead(ctx, async () => {
        const { stuId, semesters } = await resolveStuAndSemesters(deps);
        const reqSemester = (input as { semester?: string } | null)?.semester;
        const xnxq = pickTargetSemester(semesters, reqSemester);
        if (!xnxq) return [];
        const cacheKey = `zdbk:timetable:${xnxq}`;
        const cached = deps.cache.get(cacheKey);
        if (cached) return cached;
        const adapters = await deps.auth.getServiceAdapters();
        const entries = await adapters.zdbk.getTimetable(stuId, xnxq);
        deps.cache.set(cacheKey, entries);
        return entries;
      });
    },
  };
}

function makeGetWeather(deps: ToolDeps): AgentTool {
  return {
    name: "weather_get_current",
    description:
      "查询某城市当前天气。默认杭州。用户问“明天天气怎么样”“杭州天气”时调用。天气走公开接口，不需要 ZJU 账号。",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "城市名，默认杭州" },
      },
      additionalProperties: false,
    },
    riskLevel: "read",
    requiresConfirmation: false,
    async execute(input, ctx): Promise<ToolResult> {
      return runRead(ctx, async () => {
        const city =
          (input as { city?: string } | null)?.city?.trim() || "杭州";
        // 天气走公开 wttr.in，与 ZJU 账号无关，不经过 getServiceAdapters
        return deps.weather.getCurrent(city);
      });
    },
  };
}

// ---------- 操作类工具（高风险，需确认） ----------

/**
 * 下载课程资料。
 * 风险等级 external_download；单文件下载默认不需确认（见 settings.confirmSingleDownload），
 * 但 Agent 路径强制走确认流，避免静默落盘。
 * 实际执行由 confirm 流触发后调用本函数。
 */
export function makeDownloadCourseMaterial(deps: ToolDeps): AgentTool {
  return {
    name: "zju_download_course_material",
    description:
      "下载单个课程资料文件到本地。需 courseId、fileId（upload id 非 referenceId）、fileName。仅用于下载 1-2 个文件；如需批量下载多个文件，请用 zju_batch_download 一次性提交，避免逐个确认。",
    inputSchema: {
      type: "object",
      properties: {
        courseId: { type: "string" },
        materialId: { type: "string" },
        fileId: {
          type: "string",
          description: "文件的 upload id（CourseFile.id），用于 /api/uploads/{id}/blob",
        },
        fileName: { type: "string", description: "保存的文件名" },
        officePdf: {
          type: "boolean",
          description: "Office 文件(.docx/.pptx/.xlsx)是否取 PDF 预览版，默认 false",
        },
      },
      required: ["courseId", "fileId", "fileName"],
      additionalProperties: false,
    },
    riskLevel: "external_download",
    requiresConfirmation: true,
    async execute(input, ctx): Promise<ToolResult> {
      return runRead(ctx, async () => {
        const body = input as {
          courseId: string;
          materialId?: string;
          fileId: string;
          fileName: string;
          officePdf?: boolean;
        };
        if (!body.fileId || !body.fileName) {
          return {
            ok: false,
            error: { code: "TOOL_INPUT_INVALID", message: "缺少 fileId 或 fileName" },
          };
        }
        const adapters = await deps.auth.getServiceAdapters();
        const { writeDownloadStream } = await import("../util/download.js");
        const safeName = sanitizeFileName(body.fileName);
        const subdir = sanitizeDir(body.materialId || body.courseId);
        const result = await writeDownloadStream({
          stream: async () => {
            const file = await adapters.courses.fetchFile(body.fileId, {
              officePdf: body.officePdf,
            });
            return file.stream;
          },
          downloadDir: deps.config.downloadDir,
          subdir,
          fileName: safeName,
        });
        const record = deps.downloads.create({
          source: "courses",
          fileName: result.fileName,
          filePath: result.filePath,
          status: "completed",
          size: result.size,
          mimeType: result.contentType,
          courseId: body.courseId,
          materialId: body.materialId,
          fileId: body.fileId,
        });
        deps.audit.log({
          action: "download",
          riskLevel: "external_download",
          inputSummary: `agent/${body.courseId}/${body.fileId}/${safeName}`,
          confirmed: true,
          result: "ok",
        });
        return {
          id: record.id,
          fileName: record.fileName,
          filePath: record.filePath,
          size: record.size,
        };
      });
    },
  };
}

/**
 * 批量下载课程资料。一次确认即可下载多个文件，无需逐个确认。
 * 每个文件独立下载，单个失败不影响其他文件。
 */
function makeBatchDownload(deps: ToolDeps): AgentTool {
  return {
    name: "zju_batch_download",
    description:
      "批量下载多个课程资料文件到本地。一次确认即可完成全部下载，无需逐个确认。用户说【下载所有课件】【把这门课的资料都下载下来】时优先使用本工具。每个文件需 courseId、fileId（upload id 非 referenceId）、fileName。",
    inputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          description: "要下载的文件列表",
          items: {
            type: "object",
            properties: {
              courseId: { type: "string" },
              materialId: { type: "string" },
              fileId: { type: "string", description: "文件的 upload id（CourseFile.id），非 referenceId" },
              fileName: { type: "string", description: "保存的文件名" },
              officePdf: { type: "boolean", description: "Office 文件是否取 PDF 预览版，默认 false" },
            },
            required: ["courseId", "fileId", "fileName"],
            additionalProperties: false,
          },
          minItems: 1,
          maxItems: 50,
        },
      },
      required: ["files"],
      additionalProperties: false,
    },
    riskLevel: "external_download",
    requiresConfirmation: true,
    async execute(input, ctx): Promise<ToolResult> {
      return runRead(ctx, async () => {
        const body = input as {
          files: Array<{
            courseId: string;
            materialId?: string;
            fileId: string;
            fileName: string;
            officePdf?: boolean;
          }>;
        };
        if (!body.files || body.files.length === 0) {
          return {
            ok: false,
            error: { code: "TOOL_INPUT_INVALID", message: "files 数组不能为空" },
          };
        }
        const adapters = await deps.auth.getServiceAdapters();
        const { writeDownloadStream } = await import("../util/download.js");

        const results: Array<{
          fileId: string;
          fileName: string;
          success: boolean;
          filePath?: string;
          size?: number;
          error?: string;
        }> = [];

        for (const f of body.files) {
          try {
            const safeName = sanitizeFileName(f.fileName);
            const subdir = sanitizeDir(f.materialId || f.courseId);
            const streamResult = await writeDownloadStream({
              stream: async () => {
                const file = await adapters.courses.fetchFile(f.fileId, {
                  officePdf: f.officePdf,
                });
                return file.stream;
              },
              downloadDir: deps.config.downloadDir,
              subdir,
              fileName: safeName,
            });
            const record = deps.downloads.create({
              source: "courses",
              fileName: streamResult.fileName,
              filePath: streamResult.filePath,
              status: "completed",
              size: streamResult.size,
              mimeType: streamResult.contentType,
              courseId: f.courseId,
              materialId: f.materialId,
              fileId: f.fileId,
            });
            deps.audit.log({
              action: "download",
              riskLevel: "external_download",
              inputSummary: `batch/${f.courseId}/${f.fileId}/${safeName}`,
              confirmed: true,
              result: "ok",
            });
            results.push({
              fileId: f.fileId,
              fileName: safeName,
              success: true,
              filePath: record.filePath,
              size: record.size,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.warn("批量下载单文件失败", { fileId: f.fileId, fileName: f.fileName, message });
            results.push({
              fileId: f.fileId,
              fileName: f.fileName,
              success: false,
              error: message,
            });
          }
        }

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        return {
          summary: `批量下载完成：${succeeded} 成功，${failed} 失败`,
          results,
        };
      });
    },
  };
}

// ---------- 辅助 ----------

/** 按学期过滤课程（学期 id 后缀 "-2" 映射春夏学期） */
function filterBySemester(courses: Course[], semesterId: string): Course[] {
  // 学在浙大学期 id 形如 "xxx2024-2025-2xxx" 或 "xxx2024-2025-1xxx"
  // 教务网格式 "2024-2025-2"
  const [year, term] = semesterId.split("-").filter(Boolean);
  // 构建可能的学在浙大学期 id 前缀匹配
  return courses.filter((c) => {
    const sid = c.semesterId;
    // 教务网 "2024-2025-2" → 学在浙大可能包含 "2024-2025" 和第2学期特征
    return (
      sid.includes(`${year}-${Number(year) + 1}`) &&
      (term === "2" ? /春|夏/.test(sid) || sid.endsWith("-2") : /秋|冬|短/.test(sid) || sid.endsWith("-1"))
    );
  });
}

/** 包裹读取类工具的执行：把 AppError 转 ToolResult，日志脱敏 */
async function runRead(
  _ctx: ToolContext,
  fn: () => Promise<unknown>,
): Promise<ToolResult> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "UNKNOWN_ERROR";
    const message =
      err instanceof Error ? err.message : "工具执行失败";
    logger.warn("工具执行失败", { code, message });
    return { ok: false, error: { code, message } };
  }
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/\.\.+/g, ".").trim();
  const safe = base.replace(/[<>:"|?* ]/g, "_");
  return safe.slice(0, 180) || `file-${Date.now()}`;
}

function sanitizeDir(name: string): string {
  const safe = sanitizeFileName(name);
  return safe.slice(0, 80) || "misc";
}
