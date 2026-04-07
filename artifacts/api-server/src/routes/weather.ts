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

// Reverse geocode lat/lon → human-readable city name via Nominatim
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "SmartFasal/1.0 (smart-fasal-app)" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return "Your Location";
    const json = (await res.json()) as {
      address?: {
        city?: string; town?: string; village?: string;
        county?: string; state_district?: string; state?: string; country?: string;
      };
    };
    const a = json.address ?? {};
    const place = a.city ?? a.town ?? a.village ?? a.county ?? a.state_district ?? "";
    const state = a.state ?? "";
    return place ? `${place}, ${state}` : state || "Your Location";
  } catch {
    return "Your Location";
  }
}

// Fetch weather for any arbitrary lat/lon directly (used for GPS-based requests)
async function fetchOpenMeteoForCoords(lat: number, lon: number, location: string): Promise<WeatherCache["data"] | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code,apparent_temperature` +
    `&timezone=Asia%2FKolkata`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current: {
        temperature_2m: number; relative_humidity_2m: number;
        precipitation: number; wind_speed_10m: number;
        weather_code: number; apparent_temperature: number;
      };
    };
    const c = json.current;
    return {
      temperature: Math.round(c.temperature_2m * 10) / 10,
      humidity: Math.round(c.relative_humidity_2m),
      rainfall: Math.round(c.precipitation * 10) / 10,
      description: wmoDescription(c.weather_code),
      location,
      windSpeed: Math.round(c.wind_speed_10m * 10) / 10,
      feelsLike: Math.round(c.apparent_temperature * 10) / 10,
      updatedAt: new Date(),
    };
  } catch {
    return null;
  }
}

// Cache for GPS-based requests keyed by rounded lat/lon string
const gpsCache = new Map<string, WeatherCache>();

// IP-based geolocation — resolves the real user IP from headers and calls ip-api.com
router.get("/geoip", async (req, res): Promise<void> => {
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? "";

  // Strip IPv6 loopback prefix
  const ip = rawIp.replace(/^::ffff:/, "");
  const isPrivate = !ip || ip === "::1" || /^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

  if (isPrivate) {
    res.json({ lat: null, lon: null, location: null });
    return;
  }

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=lat,lon,city,regionName,status`, { signal: controller.signal });
    clearTimeout(tid);
    const data = await geoRes.json() as { lat: number; lon: number; city: string; regionName: string; status: string };
    if (data.status === "success") {
      console.log(`[GeoIP] ${ip} → ${data.city}, ${data.regionName} (${data.lat}, ${data.lon})`);
      res.json({ lat: data.lat, lon: data.lon, location: `${data.city}, ${data.regionName}` });
    } else {
      res.json({ lat: null, lon: null, location: null });
    }
  } catch {
    res.json({ lat: null, lon: null, location: null });
  }
});

router.get("/weather", async (req, res): Promise<void> => {
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lon = req.query.lon ? Number(req.query.lon) : null;

  // GPS-based: fetch weather for exact user location
  if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cached = gpsCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.json(GetWeatherResponse.parse(cached.data));
      return;
    }
    // Reverse geocode and fetch weather in parallel
    const [locationName, liveData] = await Promise.all([
      reverseGeocode(lat, lon),
      fetchOpenMeteoForCoords(lat, lon, ""),
    ]);
    if (liveData) {
      liveData.location = locationName;
      gpsCache.set(cacheKey, { data: liveData, fetchedAt: Date.now() });
      console.log(`[Weather] ✅ GPS live — ${locationName} ${liveData.temperature}°C`);
      res.json(GetWeatherResponse.parse(liveData));
      return;
    }
    if (cached) { res.json(GetWeatherResponse.parse(cached.data)); return; }
  }

  // Fallback: cycle through preset Indian regions by hour
  const regionIndex = Math.floor(Date.now() / (60 * 60 * 1000)) % REGIONS.length;
  const cached = cache.get(regionIndex);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    res.json(GetWeatherResponse.parse(cached.data));
    return;
  }
  const live = await fetchOpenMeteo(regionIndex);
  if (live) {
    cache.set(regionIndex, { data: live, fetchedAt: Date.now() });
    console.log(`[Weather] ✅ Live data from Open-Meteo — ${live.location} ${live.temperature}°C`);
    res.json(GetWeatherResponse.parse(live));
    return;
  }
  if (cached) { res.json(GetWeatherResponse.parse(cached.data)); return; }

  const region = REGIONS[regionIndex]!;
  res.json(GetWeatherResponse.parse({
    temperature: 30, humidity: 60, rainfall: 0,
    description: "Partly Cloudy", location: region.location,
    windSpeed: 12, feelsLike: 32, updatedAt: new Date(),
  }));
});

export default router;
