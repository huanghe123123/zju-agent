/**
 * 设置路由：读取/更新模型 provider、ZJU 凭据、应用设置。
 * 敏感字段不回传，仅返回脱敏状态。
 */

import type { FastifyPluginAsync } from "fastify";
import {
  ok,
  wrap,
  AppError,
  ErrorCode,
  type ModelProviderConfig,
} from "@zju-agent/core";
import type { ServicesContainer } from "../services.js";
import type { ServerConfig } from "../config/env.js";

const SETTING_KEY = "model-providers";
const APP_SETTING_KEY = "app-settings";

export function settingsRoutes(
  deps: ServicesContainer & { config: ServerConfig },
): FastifyPluginAsync {
  return async (app) => {
    // GET /api/settings — 返回脱敏设置 + 凭据状态
    app.get("/", async () => {
      const providers = deps.settings.get<ModelProviderConfig[]>(
        SETTING_KEY,
      );
      const appSettings = deps.settings.get<Record<string, unknown>>(
        APP_SETTING_KEY,
      );
      const credStatus = await deps.auth.getStatus();
      return ok({
        modelProviders: (providers ?? []).map(maskProvider),
        appSettings: appSettings ?? {},
        credentials: credStatus,
      });
    });

    // PUT /api/settings/model-providers
    app.put<{ Body: ModelProviderConfig | ModelProviderConfig[] }>(
      "/model-providers",
      async (req) => {
        return wrap(async () => {
          const body = req.body;
          const list = Array.isArray(body) ? body : [body];
          for (const p of list) {
            if (!p.id || !p.baseUrl || !p.model) {
              throw new AppError(
                ErrorCode.MODEL_PROVIDER_INVALID,
                "模型 provider 缺少必要字段（id / baseUrl / model）。",
              );
            }
          }
          deps.settings.set<ModelProviderConfig[]>(SETTING_KEY, list);
          // 敏感 apiKey 写入加密凭据存储
          await deps.credentials.set("model-providers", list);
          return list.map(maskProvider);
        });
      },
    );

    // PUT /api/settings/zju-credential
    app.put<{ Body: { username: string; password: string } }>(
      "/zju-credential",
      async (req) => {
        return wrap(async () => {
          const { username, password } = req.body ?? { username: "", password: "" };
          await deps.auth.setCredential({ username, password });
          return { ok: true };
        });
      },
    );

    // PUT /api/settings/app — 非敏感应用设置
    app.put<{ Body: Record<string, unknown> }>("/app", async (req) => {
      return wrap(async () => {
        deps.settings.set(APP_SETTING_KEY, req.body);
        return { ok: true };
      });
    });
  };
}

function maskProvider(p: ModelProviderConfig): ModelProviderConfig {
  return {
    ...p,
    apiKey: p.apiKey ? `***${p.apiKey.slice(-4)}` : "",
  };
}
