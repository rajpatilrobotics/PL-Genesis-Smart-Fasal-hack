import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Check existing session first (backward compat)
  const sessionUserId = (req as any).session?.userId as number | undefined;
  if (sessionUserId) {
    (req as any).userId = sessionUserId;
    next();
    return;
  }

  // Accept Supabase Bearer JWT
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
        if (payload.sub) {
          // Use sub as a string userId; backend DB queries that need a numeric
          // userId fall back to 1 (the seeded demo farm) for hackathon purposes.
          (req as any).userId = 1;
          (req as any).supabaseUserId = payload.sub;
          (req as any).isGuest = payload.is_anonymous ?? false;
          next();
          return;
        }
      }
    } catch {
      // malformed token — fall through to 401
    }
  }

  res.status(401).json({ error: "Unauthorized" });
}
