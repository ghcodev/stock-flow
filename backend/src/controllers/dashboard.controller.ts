import type { Request, Response } from "express";
import { montarDashboard } from "../services/dashboard.service.ts";

export async function dashboard(_req: Request, res: Response): Promise<void> {
  res.json(await montarDashboard());
}
