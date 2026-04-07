import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  (req as any).userId = "default-user";
  next();
}
