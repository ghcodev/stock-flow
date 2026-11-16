import type { Request, Response } from "express";
import { listarAuditoria, type FiltroAuditoria } from "../services/auditoria.service.ts";
import { dadosValidados } from "../validators/comuns.ts";

export async function auditoria(req: Request, res: Response): Promise<void> {
  res.json(await listarAuditoria(dadosValidados<FiltroAuditoria>(req, ["query"])));
}
