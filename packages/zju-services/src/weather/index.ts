/**
 * 天气适配器。
 * 默认城市杭州。使用 uapis.cn 免费公共接口。
 */

import {
  AppError,
  ErrorCode,
  type WeatherForecast,
  type WeatherNow,
} from "@zju-agent/core";

const BASE = "https://uapis.cn/api/v1/misc/weather";

export class WeatherService {
  async getCurrent(city: string): Promise<WeatherNow> {
    try {
      const url = `${BASE}?city=${encodeURIComponent(city)}&extended=true`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new AppError(
          ErrorCode.WEATHER_PROVIDER_FAILED,
          `天气查询失败，HTTP ${res.status}`,
        );
      }
      const json = (await res.json()) as {
        now?: {
          temp?: string;
          humidity?: string;
          text?: string;
          windDir?: string;
          windScale?: string;
          windSpeed?: string;
        };
        updateTime?: string;
      };
      const now = json.now;
      return {
        city,
        temperature: now?.temp ? Number(now.temp) : undefined,
        condition: now?.text,
        humidity: now?.humidity ? Number(now.humidity) : undefined,
        wind: now?.windDir
          ? `${now.windDir} ${now.windScale ?? ""}级`
          : undefined,
        updatedAt: json.updateTime ?? new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        ErrorCode.WEATHER_PROVIDER_FAILED,
        "天气查询失败，请检查网络。",
        { retryable: true, cause: err },
      );
    }
  }

  async getForecast(city: string): Promise<WeatherForecast> {
    try {
      const url = `${BASE}?city=${encodeURIComponent(city)}&forecast=true`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new AppError(
          ErrorCode.WEATHER_PROVIDER_FAILED,
          `天气查询失败，HTTP ${res.status}`,
        );
      }
      const json = (await res.json()) as {
        forecast?: Array<{
          date?: string;
          tempMax?: string;
          tempMin?: string;
          textDay?: string;
        }>;
      };
      return {
        city,
        days: (json.forecast ?? []).map((d) => ({
          date: d.date ?? "",
          high: d.tempMax ? Number(d.tempMax) : undefined,
          low: d.tempMin ? Number(d.tempMin) : undefined,
          condition: d.textDay,
        })),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        ErrorCode.WEATHER_PROVIDER_FAILED,
        "天气查询失败，请检查网络。",
        { retryable: true, cause: err },
      );
    }
  }
}
