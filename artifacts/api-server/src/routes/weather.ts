import { Router, type IRouter } from "express";
import { GetWeatherResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Major Indian agricultural regions with coordinates
const REGIONS = [
  { location: "Punjab, India",        lat: 30.9010, lon: 75.8573 },
  { location: "Haryana, India",       lat: 29.0588, lon: 76.0856 },
  { location: "Maharashtra, India",   lat: 19.7515, lon: 75.7139 },
  { location: "Uttar Pradesh, India", lat: 26.8467, lon: 80.9462 },
  { location: "Gujarat, India",       lat: 22.2587, lon: 71.1924 },
  { location: "Rajasthan, India",     lat: 27.0238, lon: 74.2179 },
  { location: "Madhya Pradesh, India",lat: 23.4733, lon: 77.9470 },
  { location: "Karnataka, India",     lat: 15.3173, lon: 75.7139 },
  { location: "Andhra Pradesh, India",lat: 15.9129, lon: 79.7400 },
  { location: "Tamil Nadu, India",    lat: 11.1271, lon: 78.6569 },
  { location: "West Bengal, India",   lat: 22.9868, lon: 87.8550 },
  { location: "Bihar, India",         lat: 25.0961, lon: 85.3131 },
  { location: "Odisha, India",        lat: 20.9517, lon: 85.0985 },
  { location: "Telangana, India",     lat: 18.1124, lon: 79.0193 },
  { location: "Kerala, India",        lat: 10.8505, lon: 76.2711 },
];

// WMO weather interpretation code → human-readable description
function wmoDescription(code: number): string {
  if (code === 0) return "Clear Sky";
  if (code <= 3) return "Partly Cloudy";
  if (code <= 49) return "Foggy";
  if (code <= 55) return "Drizzling";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Heavy Snow";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

// In-memory cache: keyed by region index
interface WeatherCache {
  data: {
    temperature: number;
    humidity: number;
    rainfall: number;
    description: string;
    location: string;
    windSpeed: number;
    feelsLike: number;
    updatedAt: Date;
  };
  fetchedAt: number;
}

const cache = new Map<number, WeatherCache>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchOpenMeteo(regionIndex: number): Promise<WeatherCache["data"] | null> {
  const region = REGIONS[regionIndex];
  if (!region) return null;

  const url =
    `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${region.lat}&longitude=${region.lon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code,apparent_temperature` +
    `&timezone=Asia%2FKolkata`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`[Weather] Open-Meteo returned HTTP ${res.status}`);
      return null;
    }

    const json = (await res.json()) as {
      current: {
        temperature_2m: number;
        relative_humidity_2m: number;
        precipitation: number;
        wind_speed_10m: number;
        weather_code: number;
        apparent_temperature: number;
      };
    };

    const c = json.current;
    return {
      temperature: Math.round(c.temperature_2m * 10) / 10,
      humidity: Math.round(c.relative_humidity_2m),
      rainfall: Math.round(c.precipitation * 10) / 10,
      description: wmoDescription(c.weather_code),
      location: region.location,
      windSpeed: Math.round(c.wind_speed_10m * 10) / 10,
      feelsLike: Math.round(c.apparent_temperature * 10) / 10,
      updatedAt: new Date(),
    };
  } catch (err) {
    console.error("[Weather] Open-Meteo fetch failed:", (err as Error).message);
    return null;
  }
}

router.get("/weather", async (req, res): Promise<void> => {
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lon = req.query.lon ? Number(req.query.lon) : null;

  // Find nearest region if lat/lon provided, otherwise cycle by hour
  let regionIndex: number;
  if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
    let minDist = Infinity;
    regionIndex = 0;
    for (let i = 0; i < REGIONS.length; i++) {
      const r = REGIONS[i]!;
      const dist = Math.abs(r.lat - lat) + Math.abs(r.lon - lon);
      if (dist < minDist) { minDist = dist; regionIndex = i; }
    }
  } else {
    regionIndex = Math.floor(Date.now() / (60 * 60 * 1000)) % REGIONS.length;
  }

  // Check cache
  const cached = cache.get(regionIndex);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    res.json(GetWeatherResponse.parse(cached.data));
    return;
  }

  // Fetch live from Open-Meteo
  const live = await fetchOpenMeteo(regionIndex);
  if (live) {
    cache.set(regionIndex, { data: live, fetchedAt: Date.now() });
    console.log(`[Weather] ✅ Live data from Open-Meteo — ${live.location} ${live.temperature}°C`);
    res.json(GetWeatherResponse.parse(live));
    return;
  }

  // Fallback: use cached data even if stale
  if (cached) {
    res.json(GetWeatherResponse.parse(cached.data));
    return;
  }

  // Last resort: realistic static fallback
  const region = REGIONS[regionIndex]!;
  res.json(GetWeatherResponse.parse({
    temperature: 30,
    humidity: 60,
    rainfall: 0,
    description: "Partly Cloudy",
    location: region.location,
    windSpeed: 12,
    feelsLike: 32,
    updatedAt: new Date(),
  }));
});

export default router;
