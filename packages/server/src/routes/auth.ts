/**
 * 认证路由：
 *   POST /api/auth/validate  — 验证 ZJU 统一身份认证
 *   GET  /api/auth/status    — 当前登录状态
 *   POST /api/auth/logout    — 清除凭据与 session
 *
 * 见 ZJU_CAMPUS_AGENT_PROJECT.md 第 10.1 节。
 */

import type { FastifyPluginAsync } from "fastify";
import { wrap } from "@zju-agent/core";
import type { ServicesContainer } from "../services.js";
import type { ServerConfig } from "../config/env.js";
import { logger } from "../config/logger.js";

export function authRoutes(
  deps: ServicesContainer & { config: ServerConfig },
): FastifyPluginAsync {
  return async (app) => {
    // POST /api/auth/validate
    // 可选 body: { username, password }；不传则用已保存凭据
    app.post<{ Body?: { username?: string; password?: string } }>(
      "/validate",
      async (req) => {
        return wrap(async () => {
          // 若请求体携带账号密码，则先保存再验证（便于向导「输入即验证」）
          const body = req.body ?? {};
          if (body.username && body.password) {
            await deps.auth.setCredential({
              username: body.username,
              password: body.password,
            });
          }
          const status = await deps.auth.validateCredential();
          if (status.ok) {
            logger.info("ZJU 登录验证成功", {
              username: status.username,
            });
          } else {
            logger.warn("ZJU 登录验证失败", { message: status.message });
          }
          return status;
        });
      },
    );

    // GET /api/auth/status — 返回脱敏登录状态
    app.get("/status", async () => {
      return wrap(async () => deps.auth.validateCredential());
    });

    // POST /api/auth/logout — 清除凭据与 session
    app.post("/logout", async () => {
      return wrap(async () => {
        await deps.auth.logout();
        return { ok: true };
      });
    });
  };
}
