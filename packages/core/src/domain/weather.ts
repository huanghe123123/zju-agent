/** 天气领域类型 */

export type WeatherNow = {
  city: string;
  temperature?: number;
  condition?: string;
  humidity?: number;
  wind?: string;
  updatedAt?: string;
};

export type WeatherForecastDay = {
  date: string;
  high?: number;
  low?: number;
  condition?: string;
};

export type WeatherForecast = {
  city: string;
  days: WeatherForecastDay[];
};
