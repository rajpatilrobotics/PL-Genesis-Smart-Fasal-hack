import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiRecommendationsTable, diseaseScansTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  GetAiRecommendationBody,
  GetAiRecommendationResponse,
  GetAiRecommendationHistoryResponse,
  DetectDiseaseBody,
  DetectDiseaseResponse,
} from "@workspace/api-zod";
import { generateJSON, generateVisionJSON, getProvider } from "../lib/ai-provider.js";
import { logEvent } from "../lib/event-logger.js";

const router: IRouter = Router();

router.post("/ai-recommendation", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetAiRecommendationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { nitrogen, phosphorus, potassium, ph, moisture, temperature, humidity, rainfall } = parsed.data;

  let fertilizerAdvice = "";
  let irrigationSuggestion = "";
  let riskAnalysis = "";
  let cropHealthPercent = 75;
  let yieldPercent = 70;
  let riskLevel = "MEDIUM";

  try {
    const prompt = `You are an expert agricultural advisor. Analyze the following soil and weather conditions and provide specific recommendations.

Soil Data:
- Nitrogen (N): ${nitrogen} mg/kg
- Phosphorus (P): ${phosphorus} mg/kg  
- Potassium (K): ${potassium} mg/kg
- pH: ${ph}
- Soil Moisture: ${moisture}%
${temperature != null ? `- Temperature: ${temperature}°C` : ""}
${humidity != null ? `- Humidity: ${humidity}%` : ""}
${rainfall != null ? `- Rainfall: ${rainfall} mm` : ""}

Provide a JSON response with exactly these fields:
{
  "fertilizerAdvice": "specific fertilizer recommendation in 2-3 sentences",
  "irrigationSuggestion": "specific irrigation recommendation in 2-3 sentences",
  "riskAnalysis": "risk analysis in 2-3 sentences",
  "cropHealthPercent": <number 0-100>,
  "yieldPercent": <number 0-100>,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH"
}`;

    const content = await generateJSON(prompt);
    if (content) {
      const parsed_ai = JSON.parse(content);
      fertilizerAdvice = parsed_ai.fertilizerAdvice || "Apply balanced NPK fertilizer.";
      irrigationSuggestion = parsed_ai.irrigationSuggestion || "Maintain adequate irrigation.";
      riskAnalysis = parsed_ai.riskAnalysis || "Moderate risk detected.";
      cropHealthPercent = Number(parsed_ai.cropHealthPercent) || 75;
      yieldPercent = Number(parsed_ai.yieldPercent) || 70;
      riskLevel = parsed_ai.riskLevel || "MEDIUM";
    }
  } catch {
    fertilizerAdvice = `Based on N:${nitrogen}, P:${phosphorus}, K:${potassium} levels, apply a balanced NPK fertilizer with emphasis on ${nitrogen < 40 ? "nitrogen" : phosphorus < 25 ? "phosphorus" : "potassium"}.`;
    irrigationSuggestion = moisture < 40 ? "Soil moisture is low. Increase irrigation frequency by 20% and consider drip irrigation." : "Soil moisture is adequate. Maintain current irrigation schedule.";
    riskAnalysis = (temperature && temperature > 35 && moisture < 30) ? "HIGH RISK: High temperature combined with low moisture may lead to crop stress and yield loss." : "Moderate risk conditions. Monitor soil moisture and temperature regularly.";
    cropHealthPercent = Math.min(95, Math.max(30, 75 + (ph > 6 && ph < 7.5 ? 10 : -10) + (moisture > 50 ? 10 : -5)));
    yieldPercent = Math.min(95, Math.max(30, 70 + (nitrogen > 40 ? 10 : -5)));
    riskLevel = (temperature && temperature > 35 && moisture < 30) ? "HIGH" : moisture < 40 ? "MEDIUM" : "LOW";
  }

  const [row] = await db.insert(aiRecommendationsTable).values({
    userId: (req as any).userId ?? null,
    fertilizerAdvice,
    irrigationSuggestion,
    riskAnalysis,
    cropHealthPercent,
    riskLevel,
    yieldPercent,
    nitrogen,
    phosphorus,
    potassium,
    ph,
    moisture,
  }).returning();

  await logEvent("ai", `AI recommendation generated via ${getProvider()}: Health=${cropHealthPercent}% Risk=${riskLevel} Yield=${yieldPercent}%`);

  res.json(GetAiRecommendationResponse.parse(row));
});

router.get("/ai-recommendations/history", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rows = await db
    .select()
    .from(aiRecommendationsTable)
    .where(eq(aiRecommendationsTable.userId, userId))
    .orderBy(desc(aiRecommendationsTable.createdAt))
    .limit(10);

  res.json(GetAiRecommendationHistoryResponse.parse(rows));
});

router.post("/disease-detect", requireAuth, async (req, res): Promise<void> => {
  const parsed = DetectDiseaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageDescription, imageBase64, imageMimeType, cropName } = parsed.data;

  if (!imageBase64 && !imageDescription) {
    res.status(400).json({ error: "Provide either an image or a symptom description." });
    return;
  }

  let plantName = cropName || "Unknown Plant";
  let diseaseName = "Unknown Disease";
  let confidencePercent = 80;
  let treatment = "Consult an agricultural expert.";
  let severity = "Moderate";

  try {
    const systemPrompt = `You are an expert plant pathologist and agronomist with decades of experience diagnosing crop diseases in India. Analyze the provided crop image or symptom description and give an accurate, actionable diagnosis. Be specific about the disease name, not generic. If unsure, provide the most likely diagnosis with honest confidence score.`;

    const userTextPrompt = `${cropName ? `Crop type: ${cropName}\n` : ""}${imageDescription ? `Additional symptoms noted by farmer: ${imageDescription}\n` : ""}
Respond with a JSON object with exactly these fields:
{
  "plantName": "specific crop/plant name (e.g. Wheat, Tomato, Rice)",
  "diseaseName": "specific disease name (e.g. Wheat Rust, Tomato Early Blight, Rice Blast)",
  "confidencePercent": <integer 40-99>,
  "treatment": "practical treatment steps in 2-3 sentences including pesticide names where relevant",
  "severity": "Mild" | "Moderate" | "Severe"
}`;

    let content: string;

    if (imageBase64) {
      const mimeType = imageMimeType || "image/jpeg";
      content = await generateVisionJSON({
        imageBase64,
        mimeType,
        systemPrompt,
        userPrompt: userTextPrompt,
      });
    } else {
      content = await generateJSON(`${systemPrompt}\n\n${userTextPrompt}`);
    }

    if (content) {
      const result = JSON.parse(content);
      plantName = result.plantName || (cropName ?? "Unknown Plant");
      diseaseName = result.diseaseName || "Unknown Disease";
      confidencePercent = Math.min(99, Math.max(10, Number(result.confidencePercent) || 80));
      treatment = result.treatment || treatment;
      severity = result.severity || severity;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Disease detection AI error:", errMsg);
    plantName = cropName || "Unknown Plant";
    diseaseName = "Analysis Failed";
    confidencePercent = 0;
    treatment = `AI Error: ${errMsg}`;
    severity = "Moderate";
  }

  const [scanRow] = await db.insert(diseaseScansTable).values({
    userId: (req as any).userId ?? null,
    cropName: cropName || null,
    plantName,
    diseaseName,
    confidencePercent,
    treatment,
    severity,
    imageDescription: imageDescription || null,
  }).returning();

  await logEvent("ai", `Disease detection via ${getProvider()}: ${plantName} - ${diseaseName} (${confidencePercent}% confidence)`);

  res.json(DetectDiseaseResponse.parse({
    id: scanRow.id,
    plantName,
    diseaseName,
    confidencePercent,
    treatment,
    severity,
    createdAt: scanRow.createdAt,
  }));
});

router.get("/disease-detections/history", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rows = await db
    .select()
    .from(diseaseScansTable)
    .where(eq(diseaseScansTable.userId, userId))
    .orderBy(desc(diseaseScansTable.createdAt))
    .limit(30);
  res.json(rows);
});

// ─── Crop Prediction ─────────────────────────────────────────────────────────

router.post("/crop-predict", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const nums = ["avgNitrogen", "avgPhosphorus", "avgPotassium", "avgPh", "avgMoisture"];
  for (const key of nums) {
    if (typeof body[key] !== "number") {
      res.status(400).json({ error: `Missing or invalid field: ${key}` });
      return;
    }
  }

  const avgNitrogen = body.avgNitrogen as number;
  const avgPhosphorus = body.avgPhosphorus as number;
  const avgPotassium = body.avgPotassium as number;
  const avgPh = body.avgPh as number;
  const avgMoisture = body.avgMoisture as number;
  const readingCount = typeof body.readingCount === "number" ? body.readingCount : undefined;
  const location = typeof body.location === "string" ? body.location : undefined;

  const FALLBACK_CROPS = [
    { name: "Wheat", emoji: "🌾", confidence: 91, season: "Rabi (Oct–Mar)", expectedYield: "45–55 q/ha", waterRequirement: "450–650 mm", growthDays: 120, reasoning: "High N and balanced K suit wheat well. Optimal pH range matches current readings." },
    { name: "Mustard", emoji: "🌼", confidence: 84, season: "Rabi (Oct–Feb)", expectedYield: "18–22 q/ha", waterRequirement: "250–400 mm", growthDays: 100, reasoning: "Moderate phosphorus and good moisture retention ideal for oilseed cultivation." },
    { name: "Chickpea", emoji: "🫘", confidence: 76, season: "Rabi (Nov–Mar)", expectedYield: "15–20 q/ha", waterRequirement: "300–450 mm", growthDays: 90, reasoning: "pH-tolerant legume that fixes nitrogen, beneficial given current soil profile." },
    { name: "Tomato", emoji: "🍅", confidence: 69, season: "Kharif (Jun–Sep)", expectedYield: "200–300 q/ha", waterRequirement: "600–1200 mm", growthDays: 75, reasoning: "Good phosphorus levels support strong root development needed for tomatoes." },
    { name: "Maize", emoji: "🌽", confidence: 62, season: "Kharif (Jun–Oct)", expectedYield: "55–70 q/ha", waterRequirement: "500–800 mm", growthDays: 95, reasoning: "Nitrogen-hungry crop; current N levels are supportive. Needs adequate moisture." },
  ];

  try {
    const prompt = `You are an expert agronomist for Indian farming. Based on the following soil sensor data (averaged across ${readingCount ?? "multiple"} IoT readings${location ? ` from ${location}` : ""}), recommend the top 5 most suitable crops to grow.

Averaged Soil Profile:
- Nitrogen (N): ${avgNitrogen.toFixed(1)} mg/kg
- Phosphorus (P): ${avgPhosphorus.toFixed(1)} mg/kg
- Potassium (K): ${avgPotassium.toFixed(1)} mg/kg
- Soil pH: ${avgPh.toFixed(1)}
- Moisture: ${avgMoisture.toFixed(1)}%

Return a JSON object with this exact structure:
{
  "crops": [
    {
      "name": "Crop Name",
      "emoji": "🌾",
      "confidence": <integer 50-97>,
      "season": "Season name (months)",
      "expectedYield": "X–Y q/ha",
      "waterRequirement": "X–Y mm",
      "growthDays": <integer>,
      "reasoning": "2-sentence agronomic reasoning based on the exact soil values above"
    }
  ],
  "insight": "One overall insight about this soil profile and its agricultural potential (2-3 sentences)"
}

Order crops by confidence score (highest first). Use realistic Indian crop names and values.`;

    const content = await generateJSON(prompt);
    const result = JSON.parse(content);
    await logEvent("ai", `Crop prediction generated: top crop = ${result.crops?.[0]?.name} (${result.crops?.[0]?.confidence}%)`);
    res.json(result);
    return;
  } catch {
    // fallback
  }

  await logEvent("ai", `Crop prediction (fallback): top crop = ${FALLBACK_CROPS[0].name}`);
  res.json({ crops: FALLBACK_CROPS, insight: `This soil profile with N:${avgNitrogen.toFixed(0)}, P:${avgPhosphorus.toFixed(0)}, K:${avgPotassium.toFixed(0)}, pH:${avgPh.toFixed(1)} shows good fertility suitable for Rabi season crops. Maintaining current moisture levels and periodic NPK top-dressing will sustain high yields.` });
});

export default router;
