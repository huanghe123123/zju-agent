import { z } from "zod";

/** 模型 provider 协议 */
export type ModelProtocol = "openai" | "anthropic";

export const modelProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  protocol: z.enum(["openai", "anthropic"]),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  model: z.string(),
  enabled: z.boolean().default(true),
});

export type ModelProviderConfig = z.infer<typeof modelProviderConfigSchema>;

/** 应用层设置（敏感字段如 apiKey / password 不在此结构内，由凭据存储单独管理） */
export type AppSettings = {
  /** 默认使用的模型 provider id */
  defaultModelProviderId: string | null;
  /** 下载目录 */
  downloadDir: string;
  /** 单文件下载是否需要确认 */
  confirmSingleDownload: boolean;
  /** 默认课程提醒提前分钟数 */
  courseReminderLeadMinutes: number;
  /** 应用本地访问 token（后端启动时生成，前端调用 API 时带上） */
  accessToken: string | null;
};

export const appSettingsSchema = z.object({
  defaultModelProviderId: z.string().nullable(),
  downloadDir: z.string(),
  confirmSingleDownload: z.boolean().default(false),
  courseReminderLeadMinutes: z.number().int().default(15),
  accessToken: z.string().nullable(),
});
