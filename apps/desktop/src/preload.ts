/**
 * Preload 脚本：暴露安全的 API 给渲染进程。
 * 前端通过 HTTP + token 访问本机服务端。
 */

import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});
