import { app, BrowserWindow, ipcMain, Notification, dialog } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CourseResource, LoginRequest } from "../shared/types.js";
import { getMockDashboard } from "./services/mock-data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    title: "ZJU Agent",
    backgroundColor: "#08090b",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("auth:login", async (_event, request: LoginRequest) => {
  if (!request.username.trim() || !request.password.trim()) {
    return { ok: false, message: "请输入浙大账号和密码。" };
  }

  return {
    ok: true,
    displayName: request.username.includes("@") ? request.username.split("@")[0] : request.username,
    message: "已进入本地演示模式。真实登录会在抓包确认后接入。"
  };
});

ipcMain.handle("data:get-dashboard", async () => getMockDashboard());

ipcMain.handle("resource:download", async (_event, resource: CourseResource) => {
  const safeName = resource.name.replace(/[<>:"/\\|?*]/g, "_");
  const saveOptions = {
    title: "保存课程文件",
    defaultPath: path.join(app.getPath("downloads"), safeName),
    filters: [{ name: "课程文件", extensions: [safeName.split(".").pop() || "*"] }]
  };
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, saveOptions)
    : await dialog.showSaveDialog(saveOptions);

  if (result.canceled || !result.filePath) {
    return { ok: false, message: "已取消下载。" };
  }

  await mkdir(path.dirname(result.filePath), { recursive: true });
  await writeFile(
    result.filePath,
    [
      "ZJU Agent mock download",
      `Course: ${resource.course}`,
      `Name: ${resource.name}`,
      `Source: ${resource.url}`,
      "",
      "抓到真实学在浙大文件接口后，这里会替换成真实下载流。"
    ].join("\n"),
    "utf8"
  );

  return { ok: true, path: result.filePath };
});

ipcMain.handle("reminder:test", async (_event, title: string, body: string) => {
  if (!Notification.isSupported()) {
    return false;
  }

  new Notification({ title, body }).show();
  return true;
});
