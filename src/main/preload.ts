import { contextBridge, ipcRenderer } from "electron";
import type { CourseResource, DesktopApi, LoginRequest } from "../shared/types.js";

const api: DesktopApi = {
  login: (request: LoginRequest) => ipcRenderer.invoke("auth:login", request),
  getDashboard: () => ipcRenderer.invoke("data:get-dashboard"),
  downloadResource: (resource: CourseResource) => ipcRenderer.invoke("resource:download", resource),
  sendTestReminder: (title: string, body: string) => ipcRenderer.invoke("reminder:test", title, body)
};

contextBridge.exposeInMainWorld("zjuAgent", api);
