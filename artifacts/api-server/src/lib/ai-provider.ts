/**
 * AI Provider Abstraction
 *
 * Auto-detects which AI provider to use based on available environment variables:
 * - On Replit: uses OpenAI via Replit's AI Integration (AI_INTEGRATIONS_OPENAI_API_KEY)
 * - On Render/elsewhere: uses Google Gemini (GOOGLE_API_KEY)
 *
 * Both providers return the same response shape — routes don't need to know which is active.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getProvider(): "openai" | "gemini" {
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return "openai";
  }
  if (process.env.GOOGLE_API_KEY) {
    return "gemini";
  }
  return "openai";
}

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

/**
 * Generate a JSON response from a text-only prompt.
 * Used for: credit scoring, crop recommendations, risk analysis.
 */
export async function generateJSON(prompt: string): Promise<string> {
  const provider = getProvider();

  if (provider === "gemini") {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
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
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
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
 * Generate a JSON response from a text-only prompt (no image).
 * Alias of generateJSON — used for credit scoring specifically with longer output.
 */
export async function generateCreditJSON(prompt: string): Promise<string> {
  const provider = getProvider();

  if (provider === "gemini") {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 512,
      },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 512,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return completion.choices[0]?.message?.content ?? "{}";
}

export { getProvider };
