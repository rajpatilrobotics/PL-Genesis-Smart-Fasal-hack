import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as any).session?.userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}
