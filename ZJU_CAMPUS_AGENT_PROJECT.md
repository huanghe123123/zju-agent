# 浙江大学校园智能 Agent 项目开发文档

本文档面向后续代码生成模型或开发者，用于指导实现一个“浙江大学校园智能 Agent”应用。项目第一阶段只要求实现 Web 应用与本地 Node.js 后端，但架构必须兼容未来 Electron Windows 安装包和 Capacitor Android 应用。

## 1. 项目目标

开发一个本地优先的浙江大学校园智能 Agent。用户只需要配置：

- 大模型服务来源
- 大模型 API Key
- 浙江大学统一身份认证账号密码

即可通过 Web 界面和智能体完成校园事务查询与操作。

第一阶段目标：

- 实现可运行的 Web 应用。
- 实现本地 Node.js API 服务。
- 通过 npm 包 `login-zju` 接入 `login-ZJU`，完成统一身份认证和校园服务登录。
- 接入 OpenAI 格式和 Anthropic 格式的大模型 API。
- 实现校园服务工具化，让大模型可以调用工具完成查询和有限操作。
- 对作业提交、批量下载等高风险操作加入用户确认机制。
- 校网充值、智云课堂暂不作为第一阶段必须功能，仅保留模块设计和后续扩展入口。

长期目标：

- 使用 Electron 打包为 Windows 安装包。
- 使用 Capacitor 打包为 Android 应用。
- 通过模块化架构持续加入新的浙江大学校园服务。

## 2. 现有参考代码

当前仓库中已有两个参考目录：

- `login-ZJU/`
- `fiz/`

### 2.1 login-ZJU

项目地址：

`https://github.com/5dbwat4/login-ZJU.git`

本项目必须优先基于 `login-ZJU` 实现校园服务登录。

重要约束：

- `login-ZJU` 必须作为 npm 包安装使用，例如 `npm install login-zju` 或 `pnpm add login-zju`。
- 不要把当前仓库里的 `login-ZJU/` 目录当作源码子模块复制进新项目。
- 除非明确需要调试上游登录流程，否则不要修改 `login-ZJU` 源码。
- 如果 npm 包版本缺少必要修复，应优先记录问题、临时 patch 或 fork，并在文档和提交说明中解释原因。

`login-ZJU` 是一个服务端 TypeScript 库，用于帮助应用登录浙江大学相关服务。其 README 中明确说明它主要用于 server-side applications，因此本项目不应在浏览器前端直接使用它。

当前 `login-ZJU` 已实现的服务包括：

| 服务 | 域名 | 类名 |
| --- | --- | --- |
| 统一身份认证 | `zjuam.zju.edu.cn` | `ZJUAM` |
| 智云课堂 | `classroom.zju.edu.cn` / `tgmedia.cmc.zju.edu.cn` | `CLASSROOM` |
| 本科教学管理信息服务平台 | `zdbk.zju.edu.cn` | `ZDBK` |
| 表单填报助手 | `form.zju.edu.cn` | `FORM` |
| 学在浙大 | `courses.zju.edu.cn` | `COURSES` |
| 校园卡二维码页面 | `yqfkgl.zju.edu.cn` | `YQFKGL` |
| 浙大先生开放平台 | `open.zju.edu.cn` | `OPEN` |
| CC98 | `cc98.org` | `CC98` |
| ETA 三全育人平台 | `eta.zju.edu.cn` | `ETA` |
| 图书馆移动端 | `api/m.lib.zju.edu.cn` | `APILIB` |
| 预约图书馆座位系统 | `booking.lib.zju.edu.cn` | `BOOKINGLIB` |
| 教在浙大 | `alt.zju.edu.cn` | `ALT` |

典型用法：

```ts
import { ZJUAM, COURSES, ZDBK, CLASSROOM } from "login-zju";

const am = new ZJUAM(username, password);
const courses = new COURSES(am);

const res = await courses.fetch("https://courses.zju.edu.cn/api/my-semesters?");
```

### 2.2 fiz

`fiz` 是一个学在浙大第三方工具，采用 Vue + Vite + Tauri。它对学在浙大课程、课件、作业、测试、考试等功能有可参考实现。

本项目只参考 `fiz` 的接口路径、数据解析方式和业务经验，不直接继承它的 Rust/Tauri 架构。

重要约束：

- `fiz` 仅作为实现参考，不是本项目依赖。
- 非必要情况下不要复制 `fiz` 的代码。
- 如确实需要借鉴某段逻辑，应重新用本项目的 TypeScript service adapter 风格实现。
- 不要因为 `fiz` 使用 Tauri/Rust，就把本项目后端改为 Tauri/Rust。
- 不要照搬 `fiz` 的状态管理、前端组件、目录结构或本地存储方式。
- 可以参考的主要内容是校园接口路径、请求参数、返回字段解析思路和异常经验。

已确认可参考的功能包括：

- 学期列表
- 课程列表
- 课程资料列表
- 文件下载
- 作业列表
- 作业文件上传
- 作业提交
- 测试列表
- 本科教务网考试安排

### 2.3 Celechron

`Celechron` 是一个浙江大学本科教务网（`zdbk.zju.edu.cn`）相关工具，可作为本项目对接教务网 API 的实现参考。

重要约束：

- `Celechron` 仅作为实现参考，不是本项目依赖。
- 非必要情况下不要复制 `Celechron` 的代码。
- 如确实需要借鉴某段逻辑，应重新用本项目的 TypeScript service adapter 风格实现。
- 不要照搬 `Celechron` 的状态管理、前端组件、目录结构或本地存储方式。
- 可以参考的主要内容是教务网接口路径、请求参数、返回字段解析思路、课程表数据结构分析和异常经验。

已确认可参考的功能包括：

- 本科教务网课程表查询
- 本科教务网考试安排查询
- 课程表数据解析（节次、周次、教师、地点等）

## 3. 技术栈选择

### 3.1 第一阶段固定技术栈

前端：

- React
- Vite
- TypeScript
- React Router
- TanStack Query
- Zustand 或 Jotai
- Tailwind CSS + shadcn/ui（或其他轻量无运行时、不依赖 Node API 的组件库）
- 组件库选型必须兼容 Electron 和 Capacitor 打包，优先选用纯 CSS / 无服务端依赖的方案

本地后端：

- Node.js 20+
- TypeScript
- Fastify 或 Hono
- Zod
- SQLite
- `login-zju` npm 包

大模型适配：

- 自研轻量适配层
- 兼容 OpenAI Chat Completions 风格
- 兼容 Anthropic Messages 风格
- 支持 tool calling
- 支持流式输出

### 3.2 不采用的方案

第一阶段不采用：

- 纯前端直接调用 ZJU 服务
- 远端集中式后端保存所有用户账号密码
- LangChain / LangGraph 作为核心 Agent 框架
- Next.js 作为主框架
- 直接基于 Tauri/Rust 重写全部后端

原因：

- `login-ZJU` 是服务端库，适合 Node 后端。
- 本项目应通过 npm 包 `login-zju` 接入 `login-ZJU`，而不是复制源码目录。
- 本地优先可以降低账号密码上传到远端服务器带来的安全压力。
- 自研轻量 LLM 层更容易兼容不同 OpenAI-like 和 Anthropic-like 服务。
- React + Vite 更适合后续复用到 Electron 和 Capacitor。

## 4. 总体架构

项目采用本地优先的分层架构：

```text
User
  |
  v
React Web UI
  |
  v
Local API Server (Node.js)
  |
  +--> LLM Adapter
  |
  +--> Agent Tool Registry
  |
  +--> ZJU Service Modules
  |      |
  |      +--> login-zju npm package
  |      +--> courses.zju.edu.cn
  |      +--> classroom.zju.edu.cn
  |      +--> zdbk.zju.edu.cn
  |      +--> other ZJU services
  |
  +--> Local Storage
         |
         +--> SQLite
         +--> OS Keychain / encrypted credential file
         +--> Download directory
```

关键原则：

- 前端只与本机 API 服务通信。
- 前端不保存 ZJU 密码、cookie、LLM API Key。
- 所有校园服务请求都经过本地后端。
- 本地后端通过 npm 包 `login-zju` 接入浙江大学统一认证和各服务登录。
- 所有可被大模型调用的功能都注册为工具。
- 工具必须标注风险等级。
- 高风险工具必须经过用户确认。

## 5. 推荐仓库结构

建议新建项目目录，例如：

```text
zju-campus-agent/
  apps/
    web/
      src/
        pages/
        components/
        routes/
        api/
        stores/
        styles/
    desktop/
      # Electron 第二阶段启用
    android/
      # Capacitor 第二阶段启用

  packages/
    core/
      src/
        types/
        schemas/
        errors/
        tools/

    server/
      src/
        index.ts
        config/
        routes/
        auth/
        agent/
        storage/
        scheduler/

    zju-services/
      src/
        auth/
        courses/
        classroom/
        zdbk/
        network/
        weather/
        modules/

    llm/
      src/
        providers/
        adapters/
        streaming/
        tool-calls/

    storage/
      src/
        sqlite/
        keychain/
        files/

    scheduler/
      src/
        reminders/
        jobs/

  docs/
    api.md
    services.md
    security.md
    llm-tools.md

  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

推荐使用 pnpm workspace。

## 6. 模块职责

### 6.1 apps/web

React 前端应用。

职责：

- 设置向导
- 五大主页面：首页、课程、作业、考试、百宝箱
- 首页：AI 助手聊天界面 + Dashboard 信息展示
- 课程页：网格式课程表 + 学期课程总览（点击课程可跳转学在浙大资料页，暂非必须）
- 作业页：按"已截止/将截止/还不急"三类分组展示，阈值可由用户自定义
- 考试页：按学期展示考试安排，默认当前学期（不在学期中则最近一学期）
- 百宝箱页：拓展功能卡片入口（校网充值、智云课堂、天气等可选模块）
- 工具调用确认弹窗
- 本地 API 连接状态展示
- 响应式布局：桌面端左-中-右三栏，移动端底栏切换 + 可折叠侧栏

禁止：

- 不直接导入或打包 `login-ZJU` 到浏览器前端
- 不保存 ZJU 密码
- 不保存 LLM API Key
- 不直接请求校园服务域名

### 6.2 packages/server

本地 API 服务。

职责：

- 启动 HTTP API 服务
- 管理配置
- 管理本地 access token
- 管理 ZJU 凭据
- 管理 LLM API Key
- 管理校园服务 session
- 通过 npm 包 `login-zju` 获取 ZJU 服务登录能力
- 对前端提供统一 API
- 执行 Agent 工具调用
- 处理高风险确认流
- 记录审计日志

服务启动要求：

- 默认监听 `127.0.0.1`
- 默认端口可配置
- 不允许默认监听公网地址
- 启动时生成本地访问 token
- 前端调用 API 时必须带本地 token

### 6.3 packages/zju-services

校园服务适配层。

职责：

- 封装 npm 包 `login-zju`
- 提供领域化方法
- 解析校园系统返回数据
- 屏蔽 cookie、重定向、登录细节
- 统一错误处理

示例方法：

```ts
interface CoursesService {
  getSemesters(): Promise<Semester[]>;
  getCourses(): Promise<Course[]>;
  getAssignments(): Promise<Assignment[]>;
  getCourseMaterials(courseId?: string): Promise<CourseMaterial[]>;
  downloadMaterial(input: DownloadMaterialInput): Promise<DownloadedFile>;
  uploadAssignmentFile(filePath: string): Promise<UploadedFile>;
  submitAssignment(input: SubmitAssignmentInput): Promise<SubmitResult>;
}
```

### 6.4 packages/llm

大模型适配层。

职责：

- 保存统一 message 类型
- 将统一 message 转换为 OpenAI 请求
- 将统一 message 转换为 Anthropic 请求
- 解析 OpenAI tool calls
- 解析 Anthropic tool use
- 统一流式输出事件
- 隐藏不同 provider 的协议差异

### 6.5 packages/core

平台无关核心类型。

职责：

- 领域模型
- API response envelope
- 错误码
- 工具定义
- 风险等级
- 配置 schema

`core` 不应依赖 Node-only API，不应依赖 React。

## 7. 登录与凭据管理

### 7.1 AuthSessionManager

后端必须实现统一登录管理器。

```ts
type ZjuCredential = {
  username: string;
  password: string;
};

type ServiceKey =
  | "zjuam"
  | "courses"
  | "classroom"
  | "zdbk"
  | "form"
  | "yqfkgl"
  | "open"
  | "cc98"
  | "eta"
  | "apiLib"
  | "bookingLib"
  | "alt";

type AuthStatus = {
  ok: boolean;
  username?: string;
  message?: string;
  services?: Partial<Record<ServiceKey, boolean>>;
};

interface AuthSessionManager {
  setCredential(input: ZjuCredential): Promise<void>;
  validateCredential(): Promise<AuthStatus>;
  getService<T>(key: ServiceKey): Promise<T>;
  clearSessions(): Promise<void>;
  logout(): Promise<void>;
}
```

实现要求：

- `ZJUAM` 实例由统一认证账号密码创建。
- `COURSES`、`CLASSROOM`、`ZDBK` 等服务通过同一个 `ZJUAM` 实例创建。
- 服务实例懒加载。
- 登录失败要转换为结构化错误。
- 不在日志中输出密码、cookie、API Key。
- 用户修改密码后必须清除旧 session。

### 7.2 凭据保存

优先级：

1. OS Keychain
2. 本地加密文件
3. 明文文件禁止作为默认方案

敏感信息：

- ZJU 账号密码
- LLM API Key
- cookie/session
- 本地 API access token

前端只可获得脱敏信息：

```ts
type CredentialStatus = {
  hasZjuCredential: boolean;
  zjuUsernameMasked?: string;
  hasModelApiKey: boolean;
  modelProviderName?: string;
};
```

## 8. 校园功能规格

### 8.1 学在浙大

服务来源：

- npm 包 `login-zju` 提供的 `COURSES`
- `fiz` 的接口路径和解析逻辑可作为参考

必须实现功能：

- 课程信息查看
- 学期查看
- 待办事项查看
- 作业列表查看
- 作业提交
- 课程资料查看
- 课程资料下载
- 测试/小测列表查看

参考接口：

```text
GET https://courses.zju.edu.cn/api/my-semesters?
GET https://courses.zju.edu.cn/api/my-courses?...&page=1&page_size=1000
GET https://courses.zju.edu.cn/api/course/{courseId}/coursewares?...&page=1&page_size=1000
GET https://courses.zju.edu.cn/api/courses/{courseId}/homework-activities?page=1&page_size=1000
GET https://courses.zju.edu.cn/api/courses/{courseId}/exam-list?page=1&page_size=100
POST https://courses.zju.edu.cn/api/uploads
POST https://courses.zju.edu.cn/api/course/activities/{homeworkId}/submissions
GET https://courses.zju.edu.cn/api/uploads/{uploadId}/blob
GET https://courses.zju.edu.cn/api/uploads/document/{uploadId}/url?preview=true
```

领域类型：

```ts
type Semester = {
  id: string;
  name: string;
  isActive: boolean;
};

type Course = {
  id: string;
  name: string;
  semesterId: string;
  teachingClassName?: string;
  isActive: boolean;
};

type CourseFile = {
  id: string;
  referenceId?: string;
  name: string;
  size?: number;
  mimeType?: string;
};

type CourseMaterial = {
  id: string;
  courseId: string;
  courseName?: string;
  title: string;
  files: CourseFile[];
};

type Assignment = {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  deadline?: string;
  submitted: boolean;
  description?: string;
  attachments: CourseFile[];
};

type Quiz = {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  deadline?: string;
  submitted: boolean;
  url?: string;
};

type SubmitAssignmentInput = {
  assignmentId: string;
  filePath: string;
  comment?: string;
};
```

作业提交要求：

- 提交前必须弹窗确认。
- 确认内容至少包括课程名、作业标题、文件名、评论。
- 后端执行提交前再次校验 assignmentId 和 filePath。
- 提交结果必须写入审计日志。

资料下载要求：

- 单文件下载可以直接执行或确认，具体由风险策略决定。
- 必须支持批量下载（多选文件后一次性下载）。
- 批量下载必须经过用户确认。
- 批量下载应展示文件列表、总大小，并提供进度反馈。
- 如果目标文件已存在，默认自动追加序号，不覆盖。
- 下载目录可配置。

### 8.2 智云课堂

智云课堂暂定为非必须功能，不阻塞第一阶段 MVP。第一阶段只需要保留模块边界、类型设计和路由规划；实际接口调试、资源解析和下载能力可放到第二阶段或后续迭代完成。

服务来源：

- npm 包 `login-zju` 提供的 `CLASSROOM`

后续实现功能：

- 查看智云课堂课程或课堂资源
- 获取课件
- 下载课件
- 获取语音转文字文件
- 下载语音转文字文件

领域类型：

```ts
type ClassroomResourceType =
  | "courseware"
  | "transcript"
  | "video"
  | "unknown";

type ClassroomResource = {
  id: string;
  courseName?: string;
  title: string;
  type: ClassroomResourceType;
  downloadUrl?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};
```

实现要求：

- 智云课堂接口可能随页面变化，需要把解析逻辑隔离在 `classroom` adapter 内。
- 下载文件统一进入本地下载目录。
- 语音转文字文件应保留课程名、课堂名、时间信息。

### 8.3 本科教务网

服务来源：

- npm 包 `login-zju` 提供的 `ZDBK`

参考代码：

- `fiz/src-tauri/src/test.rs` 中考试查询逻辑。
- `Celechron` 中教务网课程表查询和考试安排查询的接口路径、请求参数和数据解析方式。

必须实现功能：

- 获取课程表
- 获取考试安排
- 生成课程提醒
- 生成考试提醒

领域类型：

```ts
type TimetableEntry = {
  id: string;
  courseName: string;
  teacher?: string;
  location?: string;
  weekday: number;
  startSection: number;
  endSection: number;
  weeks: number[];
  semester: string;
  rawTimeText?: string;
};

type Exam = {
  id: string;
  courseName: string;
  time?: string;
  location?: string;
  seat?: string;
  semester?: string;
};
```

提醒默认规则：

- 课程开始前 15 分钟提醒。
- 考试前 1 天提醒。
- 考试前 2 小时提醒。
- 考试前 30 分钟提醒。

用户应可在设置中修改或关闭提醒。

### 8.4 校网充值（可选模块）

校网充值属于可选模块，不阻塞第一阶段 MVP。第一阶段仅需保留模块边界、类型设计和百宝箱入口；实际对接和支付流程可后续完成。

后续实现功能：

- 查询校网账号状态。
- 查询余额、欠费或套餐信息。
- 发起充值流程。

风险要求：

- 充值属于高风险工具。
- 大模型不得静默完成充值。
- 前端必须展示金额、账号、服务、支付方式、确认按钮。
- 如果充值需要第三方支付二维码或跳转页面，后端只负责生成或打开支付流程，不能绕过用户确认。

领域类型：

```ts
type NetworkAccountStatus = {
  account: string;
  balance?: number;
  status?: string;
  packageName?: string;
  expiresAt?: string;
  raw?: unknown;
};

type NetworkRechargeInput = {
  amount: number;
  account?: string;
  paymentMethod?: string;
};

type NetworkRechargeResult = {
  orderId?: string;
  paymentUrl?: string;
  qrCodeUrl?: string;
  status: "pending_payment" | "completed" | "failed";
};
```

### 8.5 天气查询

必须实现功能：

- 当前天气查询
- 未来天气查询
- 默认城市为杭州
- 支持用户指定城市

实现建议：

- 天气服务作为独立 adapter。
- provider 可配置。
- 如果用户未配置天气 API Key，可使用免费公共接口或提示配置。

领域类型：

```ts
type WeatherNow = {
  city: string;
  temperature?: number;
  condition?: string;
  humidity?: number;
  wind?: string;
  updatedAt?: string;
};

type WeatherForecast = {
  city: string;
  days: Array<{
    date: string;
    high?: number;
    low?: number;
    condition?: string;
  }>;
};
```

## 9. Agent 与工具调用

### 9.1 模型配置

用户可配置多个模型来源。

```ts
type ModelProviderConfig = {
  id: string;
  name: string;
  protocol: "openai" | "anthropic";
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
};
```

OpenAI 兼容要求：

- 支持 `/v1/chat/completions`
- 支持 `tools`
- 支持 `tool_choice`
- 支持 streaming

Anthropic 兼容要求：

- 支持 `/v1/messages`
- 支持 `tools`
- 支持 streaming

内部统一消息类型：

```ts
type AgentMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

type ToolCall = {
  id: string;
  name: string;
  input: unknown;
};
```

工具名称兼容性要求：

- 暴露给大模型 API 的 tool name 必须只使用英文字母、数字、下划线或连字符。
- 推荐统一使用 snake_case，例如 `zju_get_courses`。
- 不要使用点号命名，例如不要使用 `zju.get_courses`。
- 工具名长度应控制在 64 个字符以内，以兼容 OpenAI 和 Anthropic 风格接口。
- 如果内部需要模块分组，应使用 `namespace`、`operation` 或 registry metadata，不要把分组写进 tool name 的点号里。

### 9.2 工具定义

```ts
type ToolRiskLevel =
  | "read"
  | "write"
  | "payment"
  | "external_download";

type ToolResult = {
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    detail?: unknown;
  };
};

type ToolContext = {
  userId: "local";
  conversationId: string;
  requestId: string;
};

type AgentTool = {
  name: string;
  namespace: string;
  operation: string;
  description: string;
  inputSchema: unknown;
  riskLevel: ToolRiskLevel;
  requiresConfirmation: boolean;
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
};
```

### 9.3 第一阶段工具清单

查询类工具：

- `zju_get_courses`
- `zju_get_timetable`
- `zju_get_assignments`
- `zju_get_quizzes`
- `zju_get_course_materials`
- `zju_get_exams`
- `weather_get_current`
- `weather_get_forecast`

操作类工具：

- `zju_download_course_material`
- `zju_batch_download_materials`
- `zju_submit_assignment`
- `zju_create_reminder`

后续可选工具：

- `zju_get_network_account_status`
- `zju_recharge_network_account`
- `zju_get_classroom_resources`
- `zju_download_classroom_resource`

风险策略：

| 工具 | 风险等级 | 是否必须确认 |
| --- | --- | --- |
| 查询课程 | `read` | 否 |
| 查询作业 | `read` | 否 |
| 查询考试 | `read` | 否 |
| 查询天气 | `read` | 否 |
| 创建提醒 | `write` | 是 |
| 下载单个资料 | `external_download` | 可配置，默认否 |
| 批量下载资料 | `external_download` | 是 |
| 提交作业 | `write` | 是 |
| 校网查询（可选） | `read` | 否 |
| 校网充值（可选） | `payment` | 是 |

### 9.4 高风险确认流程

当模型调用高风险工具时，后端不得立即执行，而应返回 pending confirmation。

```ts
type PendingConfirmation = {
  id: string;
  conversationId: string;
  toolName: string;
  riskLevel: ToolRiskLevel;
  summary: string;
  inputPreview: unknown;
  expiresAt: string;
};
```

流程：

1. 用户向 Agent 发出请求。
2. LLM 返回工具调用。
3. 后端判断工具需要确认。
4. 后端保存 pending confirmation。
5. 前端弹窗展示确认信息。
6. 用户点击确认或拒绝。
7. 如果确认，后端执行工具并继续 Agent loop。
8. 如果拒绝，后端向模型注入“用户拒绝执行该工具”的结果。

## 10. 本地 API 设计

所有 API 使用统一响应结构：

```ts
type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

type ApiError = {
  code: string;
  message: string;
  detail?: unknown;
  retryable?: boolean;
};
```

### 10.1 设置与认证

```http
GET /api/settings
PUT /api/settings/model-providers
PUT /api/settings/zju-credential
POST /api/auth/validate
POST /api/auth/logout
GET /api/auth/status
```

### 10.2 Agent

```http
POST /api/agent/chat
GET /api/agent/events/:conversationId
POST /api/agent/confirm
POST /api/agent/cancel
GET /api/agent/conversations
GET /api/agent/conversations/:id
DELETE /api/agent/conversations/:id
```

### 10.3 校园服务

```http
GET /api/zju/courses
GET /api/zju/semesters
GET /api/zju/assignments
GET /api/zju/quizzes
POST /api/zju/assignments/:id/submit
GET /api/zju/materials
POST /api/zju/materials/download
POST /api/zju/materials/batch-download
GET /api/zju/timetable
GET /api/zju/exams
GET /api/weather/current
GET /api/weather/forecast
```

可选模块 API（后续实现）：

```http
GET /api/zju/network/status
POST /api/zju/network/recharge
GET /api/zju/classroom/resources
POST /api/zju/classroom/resources/download
```

### 10.4 文件与下载

```http
GET /api/files/downloads
POST /api/files/open-folder
DELETE /api/files/downloads/:id
```

Electron 阶段可使用系统文件管理器打开目录。纯 Web 阶段只展示路径和下载状态。

## 11. 前端页面设计

### 11.1 全局布局

应用采用响应式布局，桌面端和移动端使用不同的导航和内容组织方式。

#### 设计原则

- **卡片化展示**：课程、作业、考试、功能入口等信息优先使用卡片组件呈现。卡片应包含清晰的信息层级（标题、摘要、元数据、操作按钮），视觉上干净且有明确的边界。
- **响应式优先**：所有卡片和布局必须在桌面三栏和移动端全宽下均表现良好。移动端卡片可堆叠为单列，桌面端可按网格或列表排列。
- **组件库兼容性**：选用的 UI 组件库（如 shadcn/ui）必须是纯前端无运行时依赖的方案，不依赖 Node.js API 或服务端渲染，确保后续 Electron 和 Capacitor 打包无阻碍。

#### 桌面端布局（三栏）

```text
+--------+------------------------+------------+
|        |                        |            |
| 左侧   |       中间主区域       |  右侧      |
| 导航栏 |     （主要功能）       |  辅助面板  |
|        |                        |            |
| 首页   | 首页：AI 助手聊天     | 首页：     |
| 课程   | 课程：网格式课程表     | Dashboard  |
| 作业   | 作业：作业分类列表     | 课程：     |
| 考试   | 考试：考试安排列表     | 学期总览   |
| 百宝箱 | 百宝箱：功能卡片网格   | 作业：     |
|        |                        | 分类切换   |
|        |                        | 考试：     |
|        |                        | 学期切换   |
|        |                        | 百宝箱：   |
|        |                        | （暂空）   |
+--------+------------------------+------------+
```

- **左栏**（固定宽度 ~200px）：垂直导航栏，显示五大页面图标+文字，当前页面高亮。
- **中栏**（弹性宽度）：当前页面的核心内容区域。
- **右栏**（固定宽度 ~300px）：当前页面的辅助信息面板，内容随页面切换而变化。

#### 移动端布局（底栏切换）

```text
+------------------------+
|                        |
|    主内容区域          |
|    （全宽）            |
|                        |
|  [右栏内容 → 可折叠]   |
|                        |
+------------------------+
| 首页 | 课程 | 作业 | 考试 | 百宝箱 |
+------------------------+
```

- **底栏**：固定底部，五个图标+文字标签，当前页面高亮。
- **主内容**：全宽展示当前页面核心内容。
- **右栏内容**：变为可折叠面板（accordion / bottom sheet），通过顶部或浮动按钮展开/收起。

### 11.2 首次启动向导

步骤：

1. 配置本地后端连接状态。
2. 配置大模型 provider。
3. 配置 ZJU 账号密码。
4. 验证登录。
5. 进入首页。

### 11.3 首页

首页在桌面端采用中栏+右栏布局，移动端全宽+可折叠面板。

#### 中栏：AI 助手聊天

- 普通对话
- 流式输出
- 工具调用过程展示（工具名称、输入参数、执行状态）
- 工具结果摘要展示
- 高风险确认弹窗
- 会话历史（侧边抽屉或下拉）
- 新建会话按钮

#### 右栏：Dashboard 信息

展示卡片形式的关键信息概览：

- 今日课程（课程名、时间、地点）
- 即将截止作业（标题、课程、截止时间）
- 最近考试（课程、时间、地点）
- 天气（当前温度、天气状况、未来预报摘要）
- 登录状态（ZJU 认证状态、模型连接状态）
- 系统提醒

### 11.4 课程页

#### 中栏：网格式课程表

- 以周视图网格展示当前学期课程表（行为节次、列为星期）。
- 每格显示课程名、教师、地点、周次范围。
- 点击课程卡片可查看详情（课程资料列表、作业列表）。
- 点击课程可跳转到学在浙大资料页（暂非必须，可后续实现）。
- 支持按学期切换（下拉选择器在右栏）。

#### 右栏：学期课程总览

- 下拉栏切换学期。
- 当前学期课程列表（课程名、教师、学分等）。
- 每门课可展开查看资料和作业摘要。
- 移动端：学期切换器和课程总览变为可折叠面板。

### 11.5 作业页

#### 中栏：作业列表

所有作业按截止时间状态分为三类 Tab 展示：

- **将截止**（默认展示）：即将到期的作业，时间紧迫。
- **还不急**：距截止时间还有较长时间。
- **已截止**：已过截止时间的作业。

每项作业展示：

- 课程名称
- 作业标题
- 截止时间（精确到分钟）
- 提交状态（已提交 / 未提交）
- 附件信息
- 操作按钮（查看详情、上传文件、提交）

提交功能：

- 上传文件
- 填写评论
- 提交确认弹窗

#### 右栏：分类切换与阈值设置

- 三个分类的快速切换（Tab 或列表）。
- 用户可自定义阈值：
  - **将截止阈值**：从现在起 N 小时内截止的作业归为"将截止"（默认 24 小时）。
  - 超过 N 小时的作业归为"还不急"。
  - 已过截止时间的作业归为"已截止"。
- 阈值设置保存在用户配置中。

### 11.6 考试页

#### 中栏：考试安排列表

- 按学期分组展示考试安排。
- 每项考试展示：课程名、考试时间、地点、座位号。
- 默认展示当前学期考试。
- 如果当前日期不在任何学期中，则展示最近一学期的考试。

#### 右栏：学期切换

- 下拉栏或列表切换学期。
- 显示学期名称和日期范围。
- 移动端：学期切换器变为可折叠面板。

#### 提醒设置

- 考试提醒默认规则：
  - 考试前 1 天提醒
  - 考试前 2 小时提醒
  - 考试前 30 分钟提醒
- 用户可在设置中修改或关闭提醒。
- 课程提醒默认规则：
  - 课程开始前 15 分钟提醒。

### 11.7 百宝箱页

#### 中栏：功能卡片网格

拓展功能以卡片网格形式展示，每个卡片代表一个可选模块或工具：

- **校网充值**（可选模块）：查询校网状态、余额、发起充值。
- **智云课堂**（可选模块）：查看课堂资源、下载课件和语音转文字。
- **天气查询**：查看详细天气预报。
- **资料下载管理**：查看和管理所有已下载文件。
- **提醒管理**：查看和编辑所有提醒。
- 后续可扩展更多卡片（如 CC98 浏览、图书馆座位预约等）。

点击卡片进入对应功能的详情页或弹窗操作界面。

#### 右栏

暂不放置辅助内容，保留空白或用于未来扩展（如快捷操作、最近使用等）。

### 11.8 设置页

设置页通过左栏/底栏导航或百宝箱卡片进入（不占用五大主页面位置）。

功能：

- 模型 provider 管理
- ZJU 账号管理
- 天气 provider 管理
- 下载目录
- 作业分类阈值设置（将截止 / 还不急的时间阈值）
- 提醒偏好设置
- 权限策略
- 清除本地数据
- 导出日志

## 12. 本地存储设计

### 12.1 SQLite 表建议

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE campus_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE downloads (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  remind_at TEXT NOT NULL,
  source TEXT,
  metadata TEXT,
  enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  input_summary TEXT,
  confirmed INTEGER,
  result TEXT,
  created_at TEXT NOT NULL
);
```

### 12.2 缓存策略

建议默认缓存时间：

| 数据 | 缓存时间 |
| --- | --- |
| 课程列表 | 30 分钟 |
| 作业列表 | 10 分钟 |
| 课程资料列表 | 30 分钟 |
| 考试安排 | 60 分钟 |
| 课程表 | 24 小时 |
| 天气 | 30 分钟 |

用户在 UI 中应能手动刷新。

## 13. 安全要求

必须满足：

- 本地 API 默认只绑定 `127.0.0.1`。
- 本地 API 必须有访问 token。
- ZJU 密码、API Key、cookie 不得出现在日志中。
- 错误信息返回前必须脱敏。
- 高风险操作必须记录审计日志。
- 用户可一键清除本地凭据、cookie、缓存、会话历史。
- 上传作业前必须校验文件存在、文件名、大小。
- 下载文件默认不覆盖已有文件。

建议实现：

- 对敏感配置使用 OS Keychain。
- 不可用时使用本地加密文件。
- 加密 key 可由系统 keychain 或用户本地机器信息派生，但不要把明文 key 写入配置。

## 14. Electron 兼容要求

第一阶段虽然不实现 Electron，但架构必须兼容：

- `apps/web` 构建产物可作为 Electron renderer。
- Electron main process 启动 `packages/server`。
- Renderer 仍通过 HTTP 或 IPC 调用本地服务。
- 本地下载、打开文件夹、系统通知由 Electron main process 或本地 server adapter 提供。
- Windows 安装包建议使用 `electron-builder`。

不要在 React 组件中直接写 Electron-only 代码。应通过平台适配层：

```ts
interface PlatformBridge {
  openFolder(path: string): Promise<void>;
  showNotification(input: NotificationInput): Promise<void>;
  selectFile(): Promise<string | null>;
}
```

## 15. Capacitor Android 兼容要求

第一阶段只保证架构兼容，不强制实现 Android 打包。

需要注意：

- Android 上运行 Node 本地服务可能需要额外 runtime 或插件。
- 若本地 Node 不稳定，可在第二阶段实现 Capacitor 原生插件，或允许用户连接自托管后端。
- 前端必须避免依赖浏览器不可用的 Node API。
- 文件下载、通知、后台定时任务需要 Capacitor 插件适配。

因此：

- `core`、`llm`、前端 UI 必须保持平台无关。
- 校园服务和凭据存储必须通过 adapter 抽象。
- 不要把桌面专用能力写死在业务层。

## 16. MVP 开发路线

### 阶段 1：项目骨架

- 创建 pnpm monorepo。
- 创建 React + Vite 前端。
- 创建 Node + TypeScript 本地 API 服务。
- 创建 `core`、`llm`、`zju-services` 包。
- 配置 ESLint、Prettier、TypeScript project references。
- 在后端服务包中通过包管理器安装 `login-zju`，不要复制本仓库的 `login-ZJU/` 目录。
- 实现五大页面路由框架与响应式布局（桌面三栏 + 移动端底栏）。

验收：

- 前端可启动。
- 后端可启动。
- 前端能请求后端健康检查 API。
- 五大页面可切换，布局在不同屏幕尺寸下正确展示。

### 阶段 2：配置与登录

- 实现模型 provider 配置。
- 实现 ZJU 凭据保存。
- 以 npm 依赖方式接入 `login-zju`。
- 实现登录验证。
- 实现服务实例管理。

验收：

- 用户可在设置页输入 ZJU 账号密码。
- 后端能验证统一身份认证。
- 登录失败时有明确错误。
- 日志中不出现密码。

### 阶段 3：学在浙大核心功能

- 获取学期。
- 获取课程。
- 获取作业。
- 获取课程资料。
- 单文件下载课程资料。
- 批量下载课程资料。

验收：

- 首页 Dashboard 可展示课程和近期作业。
- 课程页可展示网格式课程表和学期课程总览。
- 作业页可按”已截止/将截止/还不急”分类展示。
- 用户可单文件下载和批量下载资料到本地目录。
- 批量下载有文件列表、进度反馈和确认流程。

### 阶段 4：教务网课程表与考试

- 获取教务网课程表。
- 获取考试安排。
- 创建提醒数据。
- 实现考试页学期切换。

验收：

- 课程页可展示教务网课程表网格。
- 考试页可展示按学期分组的考试安排。
- 默认展示当前学期（或最近一学期）考试。
- 可看到默认提醒计划。

### 阶段 5：LLM 与 Agent 工具

- 实现 OpenAI 兼容 adapter。
- 实现 Anthropic 兼容 adapter。
- 实现 tool registry。
- 注册查询类工具。
- 实现 Agent 聊天流。
- 首页中栏接入 AI 助手聊天。

验收：

- 用户可在首页与 AI 助手对话。
- Agent 能调用工具并总结结果。
- 用户可问”我最近有哪些作业”。
- 用户可问”明天杭州天气怎么样”。

### 阶段 6：高风险确认与作业提交

- 实现 pending confirmation。
- 前端实现确认弹窗。
- 接入下载、批量下载、作业提交等高风险工具。

验收：

- Agent 不能静默提交作业。
- Agent 不能静默批量下载。
- 用户拒绝后，Agent 能继续对话并说明未执行。

### 阶段 7：百宝箱与可选模块

- 实现百宝箱页面卡片网格布局。
- 接入天气查询到百宝箱。
- 实现资料下载管理页面。
- 实现提醒管理页面。
- 校网充值和智云课堂预留卡片入口。

验收：

- 百宝箱页面展示功能卡片。
- 点击卡片可进入对应功能。
- 可选模块不可用时不影响核心功能。

### 阶段 8：校网充值与智云课堂（后续可选）

- 实现校网状态查询与充值流程。
- 实现智云课堂资源获取与下载。
- 注册对应 Agent 工具。

验收：

- 校网充值必须展示确认。
- 智云课堂页面可展示资源、下载课件和语音转文字文件。
- 以上功能不可用时不影响核心功能。

## 17. 测试计划

### 17.1 单元测试

必须覆盖：

- OpenAI 请求转换。
- Anthropic 请求转换。
- tool call 解析。
- 工具 schema 校验。
- 高风险工具确认判断。
- API response envelope。
- 校园服务返回数据解析。

### 17.2 集成测试

必须覆盖：

- 前端调用本地 API 健康检查。
- 设置模型 provider。
- 设置 ZJU 凭据。
- 登录验证失败路径。
- Agent 调用查询工具。
- Agent 触发高风险工具并等待确认。
- 用户确认后工具执行。
- 用户拒绝后工具不执行。

### 17.3 手动验收场景

必须验证：

- 首次打开应用后，可以完成配置向导。
- 五大页面（首页/课程/作业/考试/百宝箱）可正常切换。
- 桌面端三栏布局正确展示。
- 移动端底栏切换和可折叠面板正确展示。
- 首页 AI 助手可正常对话。
- 首页 Dashboard 展示今日课程、作业、考试、天气等信息。
- 课程页展示网格式课程表和学期课程总览。
- 可通过右栏下拉切换学期。
- 配置正确账号密码后，可以获取课程列表。
- 可以看到作业，并按”已截止/将截止/还不急”三分类正确展示。
- 用户可以自定义”将截止”和”还不急”的时间阈值。
- 考试页可按学期查看考试安排，默认当前学期。
- 百宝箱展示功能卡片网格。
- 可以单文件下载和批量下载课程资料。
- 批量下载有确认弹窗、文件列表和进度反馈。
- 可以通过 Agent 查询”我最近有什么作业”。
- 可以通过 Agent 查询天气。
- 作业提交前一定出现确认弹窗。
- 模型 API Key 错误时提示清晰。
- ZJU 登录失败时提示清晰。
- 清除本地数据后，需要重新配置。

## 18. 错误码建议

```ts
type ErrorCode =
  | "CONFIG_MISSING"
  | "MODEL_PROVIDER_INVALID"
  | "MODEL_AUTH_FAILED"
  | "ZJU_CREDENTIAL_MISSING"
  | "ZJU_AUTH_FAILED"
  | "ZJU_SERVICE_LOGIN_FAILED"
  | "ZJU_SERVICE_UNAVAILABLE"
  | "ZJU_RESPONSE_PARSE_FAILED"
  | "TOOL_INPUT_INVALID"
  | "TOOL_CONFIRMATION_REQUIRED"
  | "TOOL_CONFIRMATION_REJECTED"
  | "FILE_NOT_FOUND"
  | "FILE_DOWNLOAD_FAILED"
  | "ASSIGNMENT_SUBMIT_FAILED"
  | "NETWORK_RECHARGE_FAILED"
  | "WEATHER_PROVIDER_FAILED"
  | "UNKNOWN_ERROR";
```

错误返回示例：

```json
{
  "ok": false,
  "error": {
    "code": "ZJU_AUTH_FAILED",
    "message": "统一身份认证失败，请检查账号密码或网络状态。",
    "retryable": true
  }
}
```

## 19. 给实现模型的注意事项

实现时必须遵守：

- 不要把 `login-ZJU` 放到浏览器前端。
- 不要复制当前仓库中的 `login-ZJU/` 源码目录；应通过 npm 包安装。
- 不要复制 `fiz` 代码；`fiz` 只用于理解接口和业务行为。
- 不要让前端保存 ZJU 密码、cookie、LLM API Key。
- 不要先实现 Electron 或 Android 而忽略 Web MVP。
- 不要绕过高风险确认机制。
- 不要把所有校园功能写在一个大文件里。
- 不要让 LLM 直接拼接任意 URL 请求校园服务。
- 不要在日志中输出敏感信息。
- 不要默认监听 `0.0.0.0`。
- 不要使用依赖 Node.js API 或服务端渲染的 UI 组件库（如 Material UI 的 SSR 特性、Next.js 专属组件），以免阻碍后续 Electron/Capacitor 打包。
- 所有开发工作必须在 `dev` 分支上进行，禁止直接在 `main`/`master` 分支提交。
- 在完成阶段性功能后应及时 `git commit` 保存版本，提交信息应清晰描述改动内容。

优先完成：

1. 本地服务可启动。
2. 前端可连接本地服务。
3. 配置页可保存模型和 ZJU 凭据。
4. ZJU 登录可验证。
5. 五大页面布局（首页/课程/作业/考试/百宝箱）+ 响应式适配。
6. 学在浙大课程/作业/资料可展示。
7. 网格式课程表可展示。
8. 作业按三分类（已截止/将截止/还不急）展示。
9. 批量下载功能可用。
10. 首页 AI 助手可调用查询工具。
11. 高风险确认可用。

## 20. 默认假设

如无额外说明，开发时按以下默认假设执行：

- 部署形态：本地优先。
- 前端技术栈：React + Vite + TypeScript。
- 后端技术栈：Node.js + TypeScript。
- 大模型适配：自研轻量适配层。
- 登录库：通过 npm 包 `login-zju` 安装，来源项目为 `https://github.com/5dbwat4/login-ZJU.git`。
- `fiz`：仅作为实现参考，非必要情况下不复制其代码。
- `Celechron`：仅作为本科教务网 API 实现参考，非必要情况下不复制其代码。
- 第一阶段不要求完成 Electron 和 Android 打包。
- 第一阶段必须为 Electron 和 Capacitor 保留架构兼容性。
- 查询类工具可直接执行。
- 作业提交、批量下载、创建提醒默认需要用户确认。
- 校网充值属于可选模块，不阻塞第一阶段 MVP。
- 默认城市为杭州。
- 默认课程提醒为课前 15 分钟。
- 默认考试提醒为考前 1 天、2 小时、30 分钟。
- 默认作业"将截止"阈值为 24 小时（截止时间在 24 小时内为"将截止"，超出为"还不急"）。
- 桌面端三栏布局，移动端底栏导航+可折叠面板。
- 信息展示优先使用卡片组件，保持视觉一致性和信息层次清晰。
- UI 组件库选型必须兼容 Electron 和 Capacitor 打包（纯前端、无 Node API 依赖）。
- 所有提交在 `dev` 分支进行，阶段性功能完成后及时 commit 保存版本。
