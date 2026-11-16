import type { Request, Response } from "express";
import { exportarAlertasDeVencimento, listarAlertasDeVencimento } from "../services/alertas.service.ts";
import { dadosValidados, type Paginacao } from "../validators/comuns.ts";

export async function vencimentos(req: Request, res: Response): Promise<void> {
  res.json(await listarAlertasDeVencimento(dadosValidados<Paginacao>(req, ["query"])));
}

export async function exportacao(_req: Request, res: Response): Promise<void> {
  const csv = await exportarAlertasDeVencimento();
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="alertas-vencimento.csv"');
  res.send(csv);
}
