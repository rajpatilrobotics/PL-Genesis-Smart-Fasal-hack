import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiRecommendationsTable, diseaseScansTable } from "@workspace/db";
import { desc } from "drizzle-orm";
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

router.post("/ai-recommendation", async (req, res): Promise<void> => {
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

router.get("/ai-recommendations/history", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(aiRecommendationsTable)
    .orderBy(desc(aiRecommendationsTable.createdAt))
    .limit(10);

  res.json(GetAiRecommendationHistoryResponse.parse(rows));
});

router.post("/disease-detect", async (req, res): Promise<void> => {
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
    console.error("Disease detection AI error:", err);
    plantName = cropName || "Unknown Plant";
    diseaseName = "Analysis Failed";
    confidencePercent = 0;
    treatment = "Could not complete analysis. Please try again or consult your local agricultural extension officer.";
    severity = "Moderate";
  }

  const [scanRow] = await db.insert(diseaseScansTable).values({
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

router.get("/disease-detections/history", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(diseaseScansTable)
    .orderBy(desc(diseaseScansTable.createdAt))
    .limit(30);
  res.json(rows);
});

export default router;
