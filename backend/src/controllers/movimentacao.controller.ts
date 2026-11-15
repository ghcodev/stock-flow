import type { Request, Response } from "express";
import { registrarEntrada, type DadosEntrada } from "../services/movimentacao.service.ts";
import { contextoDe } from "../transacao.ts";
import { dadosValidados } from "../validators/comuns.ts";

export async function entrada(req: Request, res: Response): Promise<void> {
  res.status(201).json(await registrarEntrada(contextoDe(req), dadosValidados<DadosEntrada>(req, ["body"])));
}
