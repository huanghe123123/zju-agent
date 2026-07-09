/**
 * Fastify 应用装配。
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import { ok } from "@zju-agent/core";
import type { ServerConfig } from "./config/env.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { healthRoutes } from "./routes/health.js";
import { bootstrapRoutes } from "./routes/bootstrap.js";
import { settingsRoutes } from "./routes/settings.js";
import { authRoutes } from "./routes/auth.js";
import { zjuCoursesRoutes } from "./routes/zju-courses.js";
import { zdbkRoutes } from "./routes/zdbk.js";
import { filesRoutes } from "./routes/files.js";
import { agentRoutes } from "./routes/agent.js";
import type { ServicesContainer } from "./services.js";

export type ServerDeps = ServicesContainer & {
  config: ServerConfig;
};

export async function createServer(deps: ServerDeps) {
  const app = Fastify({
    logger: false,
    bodyLimit: 50 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // 鉴权钩子
  app.addHook("onRequest", createAuthMiddleware(deps.config));

  // 统一错误处理，输出 ApiResponse
  app.setErrorHandler((err, _req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    const code =
      status === 401
        ? "UNAUTHORIZED"
        : status === 400
          ? "TOOL_INPUT_INVALID"
          : "UNKNOWN_ERROR";
    const message =
      err instanceof Error ? err.message : "内部错误";
    reply.code(status).send({
      ok: false,
      error: {
        code,
        message,
        retryable: false,
      },
    });
  });

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(bootstrapRoutes(deps), { prefix: "/api" });
  await app.register(settingsRoutes(deps), { prefix: "/api/settings" });
  await app.register(authRoutes(deps), { prefix: "/api/auth" });
  await app.register(zjuCoursesRoutes(deps), { prefix: "/api/zju" });
  await app.register(zdbkRoutes(deps), { prefix: "/api/zju" });
  await app.register(filesRoutes(deps), { prefix: "/api/files" });
  await app.register(agentRoutes(deps), { prefix: "/api/agent" });

  // 简单根路由
  app.get("/", async () => ok({ name: "zju-campus-agent-server", ok: true }));

  return app;
}