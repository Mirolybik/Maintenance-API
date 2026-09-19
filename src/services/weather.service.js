import { AppError } from '../errors/index.js';

export const WeatherService = {
  getForecast: async (lat, lon) => {
    const url = new URL(process.env.WEATHER_API_URL || 'https://api.open-meteo.com/v1/forecast');
    url.searchParams.append('latitude', lat.toString());
    url.searchParams.append('longitude', lon.toString());
    url.searchParams.append('current', 'precipitation,wind_speed_10m');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), parseInt(process.env.REQUEST_TIMEOUT_MS || '5000', 10));

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
      
      const data = await res.json();
      const precip = data.current.precipitation;
      const wind = data.current.wind_speed_10m;
      
      const suitable = precip === 0 && wind < 10;
      
      return { current: data.current, windowSuitable: suitable };
    } catch (error) {
      clearTimeout(timeoutId);
      throw new AppError('Не удалось получить данные о погоде', 503, 'WEATHER_UNAVAILABLE');
    }
  }
};
