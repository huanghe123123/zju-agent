/**
 * Electron 主进程。
 * 启动本地 Fastify 服务端，然后创建窗口加载前端。
 * 服务端绑定 127.0.0.1:7788，仅本机可访问。
 */

import { app, BrowserWindow, shell } from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

const SERVER_PORT = 7788;
const SERVER_HOST = "127.0.0.1";

let serverProcess: ChildProcess | null = null;

function getServerEntry(): string {
  if (isDev) {
    return path.resolve(__dirname, "../../../packages/server/src/index.ts");
  }
  // 生产模式：server 是 extraResource，在 resources/server/
  return path.join(process.resourcesPath, "server", "index.js");
}

function getWebRoot(): string {
  if (isDev) return "http://localhost:5173";
  return `file://${path.join(__dirname, "../web")}`;
}

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const entry = getServerEntry();
    const cwd = path.resolve(__dirname, "../../..");

    if (isDev) {
      // 开发模式：使用 tsx
      serverProcess = spawn("npx", ["tsx", "watch", entry], {
        cwd,
        env: { ...process.env, NODE_ENV: "development" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      // 生产模式：server 是 extraResource
      const serverDir = path.join(process.resourcesPath, "server");
      serverProcess = spawn(process.execPath, [entry], {
        cwd: serverDir,
        env: { ...process.env, NODE_ENV: "production" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    }

    serverProcess.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(`[server] ${text}`);
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      process.stderr.write(`[server:err] ${text}`);
      // Fastify 启动成功会打印 listening 日志
      if (text.includes("listening") || text.includes("Server listening")) {
        resolve();
      }
    });

    serverProcess.on("error", (err) => {
      console.error("Server process error:", err);
      reject(err);
    });

    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Server exited with code ${code}`);
        if (!isDev) reject(new Error(`Server exited: ${code}`));
      }
    });

    // 超时兜底：3 秒后尝试连接
    setTimeout(() => resolve(), 3000);
  });
}

async function waitForServer(url: string, maxRetries = 20): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // 服务尚未就绪
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server failed to start within timeout");
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "ZJU Campus Agent",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 在默认浏览器打开外部链接
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const webRoot = getWebRoot();
  if (isDev) {
    win.loadURL(webRoot);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // 生产模式：asar 内 dist/web/ → 加载 index.html
    const indexPath = path.join(__dirname, "web/index.html");
    await win.loadFile(indexPath);
  }
}

app.whenReady().then(async () => {
  try {
    await startServer();
    const healthUrl = `http://${SERVER_HOST}:${SERVER_PORT}`;
    console.log(`Waiting for server at ${healthUrl}...`);
    await waitForServer(healthUrl);
    console.log("Server ready, creating window...");
    await createWindow();
  } catch (err) {
    console.error("Failed to start:", err);
    // 即使服务端启动失败也打开窗口（可能是 dev 模式已单独启动服务端）
    if (isDev) {
      await createWindow();
    } else {
      app.quit();
    }
  }
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
});
