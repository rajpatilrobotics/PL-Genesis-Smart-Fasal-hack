import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getProvider } from "../lib/ai-provider.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/ai-status", async (_req, res) => {
  const provider = getProvider();
  const googleKey = process.env.GOOGLE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  const status: Record<string, unknown> = {
    selectedProvider: provider,
    env: {
      GOOGLE_API_KEY: googleKey ? `set (${googleKey.slice(0, 6)}...)` : "NOT SET",
      GEMINI_API_KEY: geminiKey ? `set (${geminiKey.slice(0, 6)}...)` : "NOT SET",
      AI_INTEGRATIONS_OPENAI_BASE_URL: openaiBase ? "set" : "NOT SET",
      AI_INTEGRATIONS_OPENAI_API_KEY: openaiKey ? "set" : "NOT SET",
    },
  };

  if (provider === "gemini") {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const apiKey = googleKey || geminiKey!;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent("Reply with exactly: ok");
      const text = result.response.text().trim();
      status.geminiTest = { success: true, response: text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      status.geminiTest = { success: false, error: msg };
    }
  }

  res.json(status);
});

export default router;
