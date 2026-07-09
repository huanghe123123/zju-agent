# 接入计划

当前应用先使用 mock 数据跑通桌面体验。真实接入分三层推进。

## 1. 登录层

参考 `参考代码库/login-ZJU`：

- `ZJUAM` 负责统一身份认证。
- `COURSES` 负责 `courses.zju.edu.cn`。
- `CLASSROOM` 负责智云课堂。
- `ZDBK` 可用于教务系统课程表和考试安排。

桌面端原则：

- 密码只在本机主进程中短暂使用。
- 不写日志，不进入 renderer，不传给大模型。
- 每个学生会话使用独立 cookie jar。

## 2. Provider 层

建议定义统一数据接口：

```ts
interface CampusProvider {
  getDeadlines(): Promise<DeadlineItem[]>;
  getSchedule(): Promise<ScheduleItem[]>;
  getClassrooms(): Promise<ClassroomItem[]>;
  getResources(): Promise<CourseResource[]>;
  downloadResource(resource: CourseResource, targetPath: string): Promise<void>;
}
```

现在的 mock 数据可以替换为：

- `CoursesProvider`: DDL 和课程文件。
- `ClassroomProvider`: 智云课堂课程、直播、回放、资料。
- `ScheduleProvider`: 学在浙大简化课程表，后续可切到教务。

## 3. 桌面层

Electron 主进程负责：

- 登录。
- 网络请求。
- 文件保存。
- Windows 通知。
- 后续可加托盘后台运行。

Renderer 只负责展示和发起 IPC，不直接接触账号密码、cookie 或 token。
