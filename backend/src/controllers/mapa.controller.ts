import type { Request, Response } from "express";
import { montarMapa, type FiltroMapa } from "../services/mapa.service.ts";
import { dadosValidados } from "../validators/comuns.ts";

export async function mapa(req: Request, res: Response): Promise<void> {
  res.json(await montarMapa(dadosValidados<FiltroMapa>(req, ["query"])));
}
