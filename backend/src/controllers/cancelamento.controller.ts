import type { Request, Response } from "express";
import { cancelarContagem } from "../services/cancelamento.service.ts";
import { contextoDe } from "../transacao.ts";
import { dadosValidados } from "../validators/comuns.ts";

export async function cancelar(req: Request, res: Response): Promise<void> {
  res.json(await cancelarContagem(contextoDe(req), dadosValidados<{ id: string }>(req, ["params"]).id));
}
