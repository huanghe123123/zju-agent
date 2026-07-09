/**
 * 天气适配器。
 * 默认城市杭州。provider 可配置。
 * 未配置天气 API Key 时，使用免费公共接口。
 */

import {
  AppError,
  ErrorCode,
  type WeatherForecast,
  type WeatherNow,
} from "@zju-agent/core";

export class WeatherService {
  async getCurrent(city: string): Promise<WeatherNow> {
    // 使用 wttr.in 免费公共接口（无需 API Key）
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new AppError(
          ErrorCode.WEATHER_PROVIDER_FAILED,
          `天气查询失败，HTTP ${res.status}`,
        );
      }
      const json = (await res.json()) as {
        current_condition?: Array<{
          temp_C?: string;
          humidity?: string;
          weatherDesc?: Array<{ value?: string }>;
          windspeedKmph?: string;
        }>;
      };
      const cur = json.current_condition?.[0];
      return {
        city,
        temperature: cur?.temp_C ? Number(cur.temp_C) : undefined,
        condition: cur?.weatherDesc?.[0]?.value,
        humidity: cur?.humidity ? Number(cur.humidity) : undefined,
        wind: cur?.windspeedKmph ? `${cur.windspeedKmph} km/h` : undefined,
        updatedAt: new Date().toISOString(),
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
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new AppError(
          ErrorCode.WEATHER_PROVIDER_FAILED,
          `天气查询失败，HTTP ${res.status}`,
        );
      }
      const json = (await res.json()) as {
        weather?: Array<{
          date?: string;
          mintempC?: string;
          maxtempC?: string;
          hourly?: Array<{ weatherDesc?: Array<{ value?: string }> }>;
        }>;
      };
      return {
        city,
        days: (json.weather ?? []).map((d) => ({
          date: d.date ?? "",
          high: d.maxtempC ? Number(d.maxtempC) : undefined,
          low: d.mintempC ? Number(d.mintempC) : undefined,
          condition: d.hourly?.[0]?.weatherDesc?.[0]?.value,
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
