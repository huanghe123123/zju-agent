/**
 * 本地访问 token 鉴权中间件。
 * 前端调用 API 必须在 Authorization 头携带 Bearer token。
 * 开发期允许回退 token，便于联调。
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { ServerConfig } from "../config/env.js";
import { ErrorCode } from "@zju-agent/core";
import { fail } from "@zju-agent/core";

/** 不需要鉴权的路由前缀 */
const PUBLIC_PREFIXES = ["/api/health", "/api/bootstrap"];

export function createAuthMiddleware(config: ServerConfig) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.url.split("?")[0] ?? req.url;
    if (PUBLIC_PREFIXES.some((p) => url === p || url.startsWith(p + "/"))) {
      return;
    }
    const auth = req.headers.authorization;
    // token 优先从 header 取；二进制资源（图片/PDF 内联预览）无法设 header，回退 query
    let token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token && typeof req.query === "object" && req.query !== null) {
      const q = req.query as { token?: string };
      if (q.token) token = q.token;
    }
    const valid =
      token === config.accessToken || (config.isDev && token === config.devToken);
    if (!valid) {
      const body = fail(ErrorCode.UNAUTHORIZED, "本地访问 token 无效或缺失。");
      return reply.code(401).send(body);
    }
  };
}
