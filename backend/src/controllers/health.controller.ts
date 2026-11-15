import type { Request, Response } from "express";
import { verificarBanco } from "../services/health.service.ts";

export async function health(_req: Request, res: Response): Promise<void> {
  await verificarBanco();
  res.json({ status: "ok" });
}
