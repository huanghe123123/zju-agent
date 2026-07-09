import "../renderer/styles.css";
import type {
  AuthStatus,
  ClassroomItem,
  CourseResource,
  DashboardData,
  DeadlineItem,
  ScheduleItem
} from "../shared/types";

interface AppState {
  auth: AuthStatus;
  displayName: string;
  message: string;
  data: DashboardData | null;
  selectedView: "overview" | "deadlines" | "schedule" | "classroom" | "resources";
}

const state: AppState = {
  auth: "signed-out",
  displayName: "",
  message: "连接学在浙大、智云课堂和课程提醒的第一版工作台。",
  data: null,
  selectedView: "overview"
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

const appRoot = app;

const cnDate = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function relativeDue(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.round(diff / 36e5);
  if (hours < 0) return "已过期";
  if (hours < 24) return `${hours} 小时后`;
  return `${Math.ceil(hours / 24)} 天后`;
}

function kindLabel(kind: ClassroomItem["kind"]) {
  return kind === "live" ? "直播" : kind === "replay" ? "回放" : "资料";
}

function renderDeadline(item: DeadlineItem) {
  return `
    <article class="row-item">
      <span class="dot ${item.status === "submitted" ? "done" : "urgent"}"></span>
      <div>
        <strong>${item.title}</strong>
        <p>${item.course} · ${cnDate.format(new Date(item.dueAt))}</p>
      </div>
      <span class="chip">${relativeDue(item.dueAt)}</span>
    </article>
  `;
}

function renderSchedule(item: ScheduleItem) {
  return `
    <article class="timeline-item ${item.type}">
      <time>${cnDate.format(new Date(item.startAt))}</time>
      <div>
        <strong>${item.title}</strong>
        <p>${item.location}${item.teacher ? ` · ${item.teacher}` : ""}</p>
      </div>
      <span>${item.type === "exam" ? "考试" : "上课"}</span>
    </article>
  `;
}

function renderClassroom(item: ClassroomItem) {
  return `
    <article class="resource-row">
      <div class="file-mark ${item.kind}">${kindLabel(item.kind)}</div>
      <div>
        <strong>${item.title}</strong>
        <p>${item.course}${item.startsAt ? ` · ${cnDate.format(new Date(item.startsAt))}` : ""}</p>
      </div>
      <button class="icon-button" title="打开入口" data-open-url="${item.url}">↗</button>
    </article>
  `;
}

function renderResource(item: CourseResource) {
  return `
    <article class="resource-row">
      <div class="file-mark">FILE</div>
      <div>
        <strong>${item.name}</strong>
        <p>${item.course} · ${item.size} · ${cnDate.format(new Date(item.updatedAt))}</p>
      </div>
      <button class="icon-button" title="下载文件" data-download-id="${item.id}">↓</button>
    </article>
  `;
}

function renderShell() {
  const data = state.data;
  const deadlines = data?.deadlines ?? [];
  const schedule = data?.schedule ?? [];
  const classrooms = data?.classrooms ?? [];
  const resources = data?.resources ?? [];
  const nextDeadline = deadlines.find((item) => item.status === "open");
  const nextExam = schedule.find((item) => item.type === "exam");

  appRoot.innerHTML = `
    <main class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">Z</div>
          <div>
            <strong>ZJU Agent</strong>
            <span>Campus Desk</span>
          </div>
        </div>

        <nav class="nav-list">
          ${navButton("overview", "总览")}
          ${navButton("deadlines", "DDL")}
          ${navButton("schedule", "课程与考试")}
          ${navButton("classroom", "智云课堂")}
          ${navButton("resources", "课程文件")}
        </nav>

        <section class="sidebar-panel">
          <span class="panel-label">登录状态</span>
          <strong>${state.auth === "signed-in" ? state.displayName : "未连接"}</strong>
          <p>${state.message}</p>
        </section>
      </aside>

      <section class="workspace">
        <header class="topbar">
          <div>
            <span class="eyebrow">浙江大学校园生活助手</span>
            <h1>${titleForView()}</h1>
          </div>
          <div class="top-actions">
            <button class="ghost-button" id="refreshButton" title="刷新数据">↻</button>
            <button class="primary-button" id="reminderButton">测试提醒</button>
          </div>
        </header>

        ${state.auth === "signed-in" ? renderContent(deadlines, schedule, classrooms, resources, nextDeadline, nextExam) : renderLogin()}
      </section>
    </main>
  `;

  bindEvents();
}

function navButton(view: AppState["selectedView"], label: string) {
  return `<button class="${state.selectedView === view ? "active" : ""}" data-view="${view}">${label}</button>`;
}

function titleForView() {
  const titles: Record<AppState["selectedView"], string> = {
    overview: "今日工作台",
    deadlines: "学在浙大 DDL",
    schedule: "课程与考试",
    classroom: "智云课堂",
    resources: "课程文件"
  };
  return titles[state.selectedView];
}

function renderLogin() {
  return `
    <section class="login-stage">
      <form class="login-card" id="loginForm">
        <span class="eyebrow">本地安全登录</span>
        <h2>连接你的校园账号</h2>
        <p>第一版会在本机进程里完成登录。密码不会展示在界面里，也不会进入 mock 数据或大模型上下文。</p>
        <label>
          浙大账号
          <input name="username" autocomplete="username" placeholder="学号或统一身份认证账号" />
        </label>
        <label>
          密码
          <input name="password" type="password" autocomplete="current-password" placeholder="仅用于本机登录流程" />
        </label>
        <button class="primary-button wide" type="submit">${state.auth === "signing-in" ? "连接中..." : "进入工作台"}</button>
      </form>
    </section>
  `;
}

function renderContent(
  deadlines: DeadlineItem[],
  schedule: ScheduleItem[],
  classrooms: ClassroomItem[],
  resources: CourseResource[],
  nextDeadline?: DeadlineItem,
  nextExam?: ScheduleItem
) {
  if (state.selectedView === "deadlines") {
    return `<section class="panel-list">${deadlines.map(renderDeadline).join("")}</section>`;
  }
  if (state.selectedView === "schedule") {
    return `<section class="timeline">${schedule.map(renderSchedule).join("")}</section>`;
  }
  if (state.selectedView === "classroom") {
    return `<section class="panel-list">${classrooms.map(renderClassroom).join("")}</section>`;
  }
  if (state.selectedView === "resources") {
    return `<section class="panel-list">${resources.map(renderResource).join("")}</section>`;
  }

  return `
    <section class="hero-grid">
      <article class="metric-card urgent-card">
        <span>最近 DDL</span>
        <strong>${nextDeadline ? nextDeadline.title : "暂无待办"}</strong>
        <p>${nextDeadline ? `${nextDeadline.course} · ${relativeDue(nextDeadline.dueAt)}` : "学在浙大暂无打开的任务"}</p>
      </article>
      <article class="metric-card">
        <span>下一场考试</span>
        <strong>${nextExam ? nextExam.title : "暂无考试"}</strong>
        <p>${nextExam ? `${nextExam.location} · ${cnDate.format(new Date(nextExam.startAt))}` : "可从课程表先做简化提醒"}</p>
      </article>
      <article class="metric-card">
        <span>课程资料</span>
        <strong>${resources.length} 个文件</strong>
        <p>支持按课程保存，真实接口接入后可批量下载。</p>
      </article>
    </section>

    <section class="dashboard-grid">
      <div class="work-panel">
        <div class="panel-head"><h2>接下来</h2><span>${schedule.length} 项</span></div>
        ${schedule.slice(0, 3).map(renderSchedule).join("")}
      </div>
      <div class="work-panel">
        <div class="panel-head"><h2>学在浙大</h2><span>${deadlines.length} 项</span></div>
        ${deadlines.slice(0, 3).map(renderDeadline).join("")}
      </div>
    </section>

    <section class="work-panel">
      <div class="panel-head"><h2>智云课堂</h2><span>直播 · 回放 · 资料</span></div>
      ${classrooms.map(renderClassroom).join("")}
    </section>
  `;
}

function bindEvents() {
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedView = button.dataset.view as AppState["selectedView"];
      renderShell();
    });
  });

  document.querySelector<HTMLFormElement>("#loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    state.auth = "signing-in";
    renderShell();

    const result = await window.zjuAgent.login({
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? "")
    });

    state.auth = result.ok ? "signed-in" : "error";
    state.displayName = result.displayName ?? "";
    state.message = result.message ?? "";
    if (result.ok) {
      state.data = await window.zjuAgent.getDashboard();
    }
    renderShell();
  });

  document.querySelector<HTMLButtonElement>("#refreshButton")?.addEventListener("click", async () => {
    state.data = await window.zjuAgent.getDashboard();
    state.message = `已刷新：${cnDate.format(new Date())}`;
    renderShell();
  });

  document.querySelector<HTMLButtonElement>("#reminderButton")?.addEventListener("click", async () => {
    const next = state.data?.deadlines.find((item) => item.status === "open");
    await window.zjuAgent.sendTestReminder("ZJU Agent 提醒", next ? `${next.course}: ${next.title}` : "提醒系统已准备就绪");
  });

  document.querySelectorAll<HTMLButtonElement>("[data-download-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const resource = state.data?.resources.find((item) => item.id === button.dataset.downloadId);
      if (!resource) return;
      const result = await window.zjuAgent.downloadResource(resource);
      state.message = result.ok ? `已保存到 ${result.path}` : result.message ?? "下载已取消";
      renderShell();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-open-url]").forEach((button) => {
    button.addEventListener("click", () => {
      state.message = `真实接入后将打开：${button.dataset.openUrl}`;
      renderShell();
    });
  });
}

renderShell();
