import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

const clerkEnabled = !!process.env.CLERK_SECRET_KEY;

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!clerkEnabled) {
    (req as any).userId = "dev-user";
    next();
    return;
  }
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}
