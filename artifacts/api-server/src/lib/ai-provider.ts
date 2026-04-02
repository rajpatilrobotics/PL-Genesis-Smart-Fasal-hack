/**
 * AI Provider Abstraction
 *
 * Provider selection (in priority order):
 *   1. Replit environment: OpenAI via Replit's AI Integration
 *      (auto-configured — no API key needed, just the Replit integration)
 *      Detected via: AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY
 *
 *   2. Render / external deployment: Google Gemini free tier
 *      Set GOOGLE_API_KEY in Render environment variables.
 *      Get a free key at: https://aistudio.google.com/apikey
 *      Model: gemini-2.0-flash — supports text + vision (image analysis),
 *      free tier limits: 15 req/min, 1,500 req/day, 1M tokens/day.
 *
 * Both providers return identical response shapes — routes are provider-agnostic.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Free-tier Gemini model — supports both text and image (vision) inputs.
// Switch to gemini-1.5-flash if gemini-2.0-flash is unavailable in your region.
const GEMINI_FREE_MODEL = "gemini-2.0-flash";

function getProvider(): "openai" | "gemini" {
  // On Replit: the AI integration sets these env vars automatically.
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return "openai";
  }
  // On Render / external: use Gemini free tier if GOOGLE_API_KEY is set.
  if (process.env.GOOGLE_API_KEY) {
    return "gemini";
  }
  // Default: attempt OpenAI (will show a clear error if integration not provisioned).
  return "openai";
}

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY not set. Get a free key at https://aistudio.google.com/apikey");
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

/**
 * Generate a JSON response from a text-only prompt.
 * Used for: crop recommendations, risk analysis.
 */
export async function generateJSON(prompt: string): Promise<string> {
  const provider = getProvider();

  if (provider === "gemini") {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: GEMINI_FREE_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return completion.choices[0]?.message?.content ?? "{}";
}

/**
 * Generate a JSON response from an image + text prompt.
 * Used for: disease detection from crop photos.
 * Both gemini-2.0-flash and gpt-4o support multimodal vision inputs.
 */
export async function generateVisionJSON(params: {
  imageBase64: string;
  mimeType: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  const { imageBase64, mimeType, systemPrompt, userPrompt } = params;
  const provider = getProvider();

  if (provider === "gemini") {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: GEMINI_FREE_MODEL,
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent([
      { inlineData: { mimeType, data: imageBase64 } },
      userPrompt,
    ]);
    return result.response.text();
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 600,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: "high",
            },
          },
          { type: "text", text: userPrompt },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });
  return completion.choices[0]?.message?.content ?? "{}";
}

/**
 * Generate a JSON response from a text-only prompt with limited output.
 * Used for: credit scoring.
 */
export async function generateCreditJSON(prompt: string): Promise<string> {
  const provider = getProvider();

  if (provider === "gemini") {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: GEMINI_FREE_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 512,
      },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 512,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return completion.choices[0]?.message?.content ?? "{}";
}

export { getProvider };
