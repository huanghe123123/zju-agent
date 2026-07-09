/**
 * Bootstrap 路由：前端首次启动时获取连接状态与（开发期）访问 token。
 *
 * 安全考量：
 * - 生产模式下不返回 token，前端通过文件读取或 Electron 注入获取。
 * - 开发期为方便联调，回退 token 经此接口暴露，仅限 127.0.0.1。
 */

import type { FastifyPluginAsync } from "fastify";
import { ok } from "@zju-agent/core";
import type { ServicesContainer } from "../services.js";
import type { ServerConfig } from "../config/env.js";

export function bootstrapRoutes(
  deps: ServicesContainer & { config: ServerConfig },
): FastifyPluginAsync {
  return async (app) => {
    app.get("/bootstrap", async () => {
      const token = selectClientToken(deps.config);
      return ok({
        server: "zju-campus-agent",
        version: "0.1.0",
        isDev: deps.config.isDev,
        // 开发期返回 token，生产期为 null
        accessToken: deps.config.isDev ? token : null,
        endpoints: {
          health: "/api/health",
          settings: "/api/settings",
        },
      });
    });
  };
}

function selectClientToken(config: ServerConfig): string {
  return config.accessToken || config.devToken;
}
