/**
 * AI Provider Abstraction
 *
 * Provider selection (in priority order):
 *   1. Replit environment: OpenAI via Replit's AI Integration
 *      (auto-configured — no API key needed, just the Replit integration)
 *      Detected via: AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY
 *
 *   2. Render / external deployment: Google Gemini free tier
 *      Set GOOGLE_API_KEY or GEMINI_API_KEY in Render environment variables.
 *      Get a free key at: https://aistudio.google.com/apikey
 *      Model: gemini-2.0-flash (falls back to gemini-1.5-flash automatically)
 *      Free tier limits: 15 req/min, 1,500 req/day, 1M tokens/day.
 *
 * Both providers return identical response shapes — routes are provider-agnostic.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_PRIMARY_MODEL = "gemini-2.0-flash";
const GEMINI_FALLBACK_MODEL = "gemini-1.5-flash";

// Support GOOGLE_API_KEY (official SDK name) and GEMINI_API_KEY (common on Render/Vercel)
function getGeminiApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
}

function getProvider(): "openai" | "gemini" {
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return "openai";
  }
  if (getGeminiApiKey()) {
    return "gemini";
  }
  return "openai";
}

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error(
        "Gemini API key not set. Add GOOGLE_API_KEY or GEMINI_API_KEY to your environment variables. " +
        "Get a free key at https://aistudio.google.com/apikey"
      );
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

/**
 * Gemini sometimes wraps JSON in markdown code fences even with responseMimeType: application/json.
 * This extracts the raw JSON from such responses.
 */
function extractJSON(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

/**
 * Call a Gemini generation function, automatically falling back to gemini-1.5-flash if
 * gemini-2.0-flash fails (e.g. region unavailability or quota errors).
 */
async function withGeminiFallback(
  run: (modelName: string) => Promise<string>
): Promise<string> {
  try {
    const raw = await run(GEMINI_PRIMARY_MODEL);
    return extractJSON(raw);
  } catch (primaryErr: unknown) {
    const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.warn(`[ai-provider] ${GEMINI_PRIMARY_MODEL} failed (${msg}), retrying with ${GEMINI_FALLBACK_MODEL}…`);
    const raw = await run(GEMINI_FALLBACK_MODEL);
    return extractJSON(raw);
  }
}

/**
 * Generate a JSON response from a text-only prompt.
 * Used for: crop recommendations, risk analysis.
 */
export async function generateJSON(prompt: string): Promise<string> {
  const provider = getProvider();

  if (provider === "gemini") {
    const genAI = getGeminiClient();
    return withGeminiFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });
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
    return withGeminiFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent([
        { inlineData: { mimeType, data: imageBase64 } },
        userPrompt,
      ]);
      return result.response.text();
    });
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
    return withGeminiFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 512,
        },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });
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
