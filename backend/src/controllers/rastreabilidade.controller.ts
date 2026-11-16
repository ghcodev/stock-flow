import type { Request, Response } from "express";
import { rastrearLote, type FiltroRastreabilidade } from "../services/rastreabilidade.service.ts";
import { dadosValidados } from "../validators/comuns.ts";

export async function rastreabilidade(req: Request, res: Response): Promise<void> {
  res.json(await rastrearLote(dadosValidados<FiltroRastreabilidade>(req, ["query"])));
}
