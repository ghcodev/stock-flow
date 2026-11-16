import type { Request, Response } from "express";
import { finalizarContagem } from "../services/finalizacao.service.ts";
import { contextoDe } from "../transacao.ts";
import { dadosValidados } from "../validators/comuns.ts";

export async function finalizar(req: Request, res: Response): Promise<void> {
  res.json(await finalizarContagem(contextoDe(req), dadosValidados<{ id: string }>(req, ["params"]).id));
}
