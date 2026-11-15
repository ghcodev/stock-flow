import type { Request, Response } from "express";
import type { tipo_identificacao } from "../generated/prisma/enums.ts";
import { associarEtiqueta } from "../services/etiqueta.service.ts";
import { contextoDe } from "../transacao.ts";
import { dadosValidados, idDaRota } from "../validators/comuns.ts";

export async function associar(req: Request, res: Response): Promise<void> {
  const { tipo, codigo } = dadosValidados<{ tipo: tipo_identificacao; codigo: string }>(req, ["body"]);
  res.status(201).json(await associarEtiqueta(contextoDe(req), idDaRota(req), tipo, codigo));
}
