import { Router, type IRouter } from "express";
import { GetWeatherResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Mock weather data with realistic Indian agricultural context
const weatherData = [
  { location: "Punjab, India", temperature: 28, humidity: 65, rainfall: 5.2, windSpeed: 12, description: "Partly Cloudy" },
  { location: "Haryana, India", temperature: 32, humidity: 55, rainfall: 0, windSpeed: 15, description: "Sunny" },
  { location: "Maharashtra, India", temperature: 30, humidity: 72, rainfall: 12.5, windSpeed: 8, description: "Overcast" },
  { location: "Uttar Pradesh, India", temperature: 35, humidity: 48, rainfall: 0, windSpeed: 18, description: "Hot & Dry" },
  { location: "Gujarat, India", temperature: 38, humidity: 40, rainfall: 0, windSpeed: 22, description: "Very Hot" },
];

router.get("/weather", async (req, res): Promise<void> => {
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lon = req.query.lon ? Number(req.query.lon) : null;

  // Pick a weather profile based on lat/lon or randomly cycle
  const idx = Math.floor(Date.now() / 300000) % weatherData.length;
  const base = weatherData[idx];

  // Add slight randomness to simulate live data
  const temperature = base.temperature + (Math.random() - 0.5) * 2;
  const humidity = base.humidity + (Math.random() - 0.5) * 5;
  const feelsLike = temperature - (base.windSpeed * 0.3) + (humidity > 60 ? 3 : 0);

  const weather = {
    temperature: Math.round(temperature * 10) / 10,
    humidity: Math.round(humidity),
    rainfall: base.rainfall,
    description: base.description,
    location: base.location,
    windSpeed: base.windSpeed,
    feelsLike: Math.round(feelsLike * 10) / 10,
    updatedAt: new Date(),
  };

  res.json(GetWeatherResponse.parse(weather));
});

export default router;
